// Explicit opt-in backend service; not mounted by either existing app launcher.
import { AppError } from '../shared/policy.mjs';
import { errorResult } from './presentation.mjs';
import { validateOfflineInput } from './offline.mjs';
import { cloneBounded, createEvidenceSession } from './generation-evidence.mjs';
import { checkEffectiveGenerationAuthorization as checkGenerationAuthorization, authorizedPacket, projectOpenAIEvidence, validateAuthorizedSelection } from './generation-authorization.mjs';
import { reserveRequest, reviewedRequestTimeout } from './request-budget.mjs';
import { prepareOpenAIRequest, dispatchOpenAI } from './evidence-openai.mjs';

const COPY = {
  en: { live: 'AI selected these alternatives from retrieved evidence. Wording uses application templates.',
    test: 'Synthetic provider test only. No real AI request or real-place recommendation.',
    fallback: 'Retrieval only. AI selection did not complete; ideas use templates.', empty: 'No saved places meet these filters. Try allowing more time or changing your preferences. No recommendation-generation request was made.' },
  ru: { live: 'ИИ выбрал эти варианты по найденным данным. Текст сформирован шаблонами приложения.',
    test: 'Только синтетический тест провайдера. Без реального запроса к ИИ и рекомендаций реальных мест.',
    fallback: 'Только поиск по данным. Выбор ИИ не завершён; идеи шаблонные.', empty: 'Сохранённые места не подходят под фильтры. Попробуйте увеличить время или изменить предпочтения. Запрос на генерацию рекомендаций не отправлялся.' },
  kk: { live: 'ЖИ осы нұсқаларды табылған деректерден таңдады. Мәтін қолданба үлгілерімен берілген.',
    test: 'Тек синтетикалық провайдер тесті. Нақты ЖИ сұрауы және нақты орын туралы кеңес жоқ.',
    fallback: 'Тек деректерден іздеу. ЖИ таңдауы аяқталмады; идеялар үлгі бойынша берілген.', empty: 'Сүзгілерге сай сақталған орындар жоқ. Уақытты көбейтіп немесе қалауларыңызды өзгертіп көріңіз. Ұсыныс жасау сұрауы жіберілмеді.' },
};
const SAFE_CODES = ['GENERATION_DISABLED', 'PROVIDER_NOT_CONFIGURED', 'PROCESSING_NOT_AUTHORIZED', 'BUDGET_INVALID', 'BUDGET_BUSY',
  'BUDGET_EXHAUSTED', 'DATA_INVALID', 'DATA_UNAVAILABLE', 'INVALID_INPUT', 'OUTSIDE_COVERAGE', 'UNSUPPORTED_MODE',
  'PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_RATE_LIMIT', 'PROVIDER_REFUSAL', 'INVALID_MODEL_OUTPUT'];
const safeCode = e => e instanceof AppError && SAFE_CODES.includes(e.code) ? e.code : 'DATA_INVALID';
const keyValid = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1024 && !/[\r\n\u0000]/.test(value);

export function createBoundedGenerationService({ retrieve, expected, enabled = false, authorization = null,
  budgetDirectory = null, model = '', modelOverride = null, apiKey = '', testFetch, now = () => new Date().toISOString() } = {}) {
  const pins = cloneBounded(expected, 2048);
  const approval = authorization === null ? null : cloneBounded(authorization, 64 * 1024);
  const override = modelOverride === null ? null : cloneBounded(modelOverride, 4096);
  const testing = testFetch !== undefined;
  if (typeof retrieve !== 'function' || typeof enabled !== 'boolean'
    || (testing && (pins.dataset_kind !== 'synthetic' || typeof testFetch !== 'function'))) throw new AppError('DATA_INVALID');
  const prepare = async (raw, forReview = false) => {
    let input, session, reservation, packet, usage = null, uncertain = false, dispatched = false, diagnostics = null;
    const metadata = (outcome, failure_code = null) => ({ mode: testing ? 'synthetic_provider_test' : 'openai', outcome,
      attempt: reservation?.attempt ?? null, reserved_attempts: reservation ? 1 : 0, dispatch_attempts: dispatched ? 1 : 0,
      external_requests: dispatched && !testing ? 1 : 0, failure_code, ...(diagnostics ?? {}) });
    const localResult = (outcome, code = null) => {
      const result = outcome === 'empty' ? session.noMatch() : session.fallback('MOCK_FAILURE');
      result.status = outcome === 'empty' ? 'no_match' : 'retrieval_only';
      result.message = COPY[result.language][outcome === 'empty' ? 'empty' : 'fallback'];
      result.generation = metadata(outcome, code);
      return result;
    };
    try {
      input = validateOfflineInput(cloneBounded(raw, 16 * 1024));
      const authorize = () => {
        if (!enabled) throw new AppError('GENERATION_DISABLED');
        if (!keyValid(apiKey) || !keyValid(model)) throw new AppError('PROVIDER_NOT_CONFIGURED');
        if (!testing && pins.dataset_kind !== 'collected') throw new AppError('PROCESSING_NOT_AUTHORIZED');
        return checkGenerationAuthorization(approval, pins, model, now(), override);
      };
      if (!forReview) authorize();
      const timestamp = now();
      const envelope = cloneBounded(await retrieve(cloneBounded({ ...input, now: timestamp, query_terms: [], limit: 10 }, 16 * 1024)), 512 * 1024);
      session = createEvidenceSession({ input, envelope, expected: pins, now: timestamp });
      if (!session.packet.candidates.length) return localResult('empty');
      // Recheck expiry after retrieval before authorizing the exact selected subset.
      let decision;
      try {
        decision = authorize();
        packet = authorizedPacket(session, envelope, decision.authorization);
      } catch (error) {
        if (!forReview) throw error;
        return { display: { status: 'generation_preview', ready: false, failure_code: safeCode(error),
          packet: projectOpenAIEvidence(session), request: null, request_body: null, limits: null } };
      }
      const body = prepareOpenAIRequest(packet, model, decision.authorization.limits.max_output_tokens);
      let used = false;
      const execute = async () => {
        if (used) return localResult('blocked', 'INVALID_INPUT');
        used = true;
        try {
        if (forReview) authorize();
        reservation = await reserveRequest(budgetDirectory, decision.budget);
        let result, outcome;
        try {
          // Expiry could pass while waiting on local disk; a reserved slot is never refunded.
          checkGenerationAuthorization(approval, pins, model, now(), override);
          dispatched = true;
          const response = await dispatchOpenAI({ enabled: true, body, apiKey, timeoutMs: reservation.timeoutMs,
            ...(testing ? { fetchImpl: testFetch } : {}) });
          usage = response.usage;
          result = session.complete(response.selection); // strict alias, field evidence, allowed-code validation
          validateAuthorizedSelection(response.selection, packet);
          result.status = testing ? 'synthetic_provider_test' : 'live_rag';
          result.message = COPY[result.language][testing ? 'test' : 'live'];
          result.recommendations.forEach(c => { c.activity.kind = testing ? 'template_suggestion' : 'generated_selection_template'; });
          result.generation = metadata('selected');
          outcome = 'selected';
        } catch (error) {
          const code = safeCode(error);
          diagnostics = { provider_http_status: error?.providerHttpStatus ?? null, provider_error_code: error?.providerErrorCode ?? null };
          uncertain = error?.uncertain === true;
          outcome = uncertain ? 'unknown' : code === 'INVALID_MODEL_OUTPUT' ? 'invalid_output'
            : code === 'PROVIDER_REFUSAL' ? 'refusal' : ['PROVIDER_UNAVAILABLE', 'PROVIDER_RATE_LIMIT'].includes(code) ? 'http_error' : 'provider_error';
          result = localResult('fallback', code);
        }
        try { await reservation.finish({ outcome, usage, uncertain }); }
        catch { return localResult('fallback', 'BUDGET_INVALID'); }
        return result;
        } catch (error) { return localResult('blocked', safeCode(error)); }
      };
      let timeoutMs = decision.authorization.limits.timeout_ms;
      try { timeoutMs = await reviewedRequestTimeout(budgetDirectory, decision.budget); } catch { /* Reservation will reject invalid or busy accounting. */ }
      return forReview ? { display: { status: 'generation_preview', ready: true, failure_code: null,
        packet, request: JSON.parse(body), request_body: body, limits: { ...decision.authorization.limits, timeout_ms: timeoutMs } }, execute } : execute();
    } catch (error) {
      const code = safeCode(error);
      if (session) return localResult('blocked', code);
      const result = errorResult(['INVALID_INPUT', 'OUTSIDE_COVERAGE', 'UNSUPPORTED_MODE', 'DATA_UNAVAILABLE'].includes(code) ? code
        : ['GENERATION_DISABLED', 'PROVIDER_NOT_CONFIGURED'].includes(code) ? 'PROVIDER_NOT_CONFIGURED' : 'DATA_INVALID', input?.language);
      result.generation = metadata('blocked', code);
      return result;
    }
  };
  const recommend = raw => prepare(raw);
  recommend.prepareForReview = raw => prepare(raw, true);
  return recommend;
}
