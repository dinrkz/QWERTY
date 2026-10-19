import { AppError, detectLanguage } from '../shared/policy.mjs';
import { mergeIntent, validateGenerated, validateInput, validateRetrieval } from '../shared/validate.mjs';
import { errorResult, fallbackSelections, present } from './presentation.mjs';

export function createService({ interpret, retrieve, generate, now = () => new Date().toISOString(), allowSynthetic = false }) {
  return async function recommend(raw) {
    let language = detectLanguage(typeof raw?.query === 'string' ? raw.query : '', raw?.language ?? 'ru');
    let request;
    try {
      request = validateInput(raw);
      language = request.language;
      request = { ...mergeIntent(request, await interpret(request)), now: now() };
      const retrieval = validateRetrieval(await retrieve(request), request);
      if (retrieval.dataset_kind === 'synthetic' && !allowSynthetic) throw new AppError('DATA_INVALID');
      if (!retrieval.candidates.length) return present(request, retrieval, { recommendations: [] }, 'no_match');
      try {
        const generated = validateGenerated(await generate(request, retrieval.candidates), request, retrieval.candidates);
        return present(request, retrieval, generated, 'live_rag');
      } catch (error) {
        const result = present(request, retrieval, fallbackSelections(request, retrieval.candidates), 'retrieval_only');
        result.warnings.push(errorResult(error instanceof AppError ? error.code : 'PROVIDER_UNAVAILABLE', language).message);
        return result;
      }
    } catch (error) {
      return errorResult(error instanceof AppError ? error.code : 'INTERNAL_ERROR', language);
    }
  };
}
