import { allowedActivities, freshEvidence, scheduledVisit } from '../shared/policy.mjs';
import { providerContext } from './openai.mjs';

const COPY = {
  ru: {
    live: 'Выберите одну из этих альтернатив.', fallback: 'Только поиск по данным: ИИ-генерация не завершена. Идеи ниже — шаблонные.',
    synthetic: 'Тест на синтетических данных. Это не рекомендации реальных мест и не live RAG.',
    empty: 'Подтверждённых вариантов под эти ограничения не найдено. Попробуйте изменить радиус, время или обязательный фильтр.',
    partial: 'Найдено меньше трёх подходящих вариантов — список не дополнен вымышленными местами.',
    reasons: { nearby: 'Рядом с выбранной точкой по прямой.', fits_time: 'Укладывается в ваш бюджет по указанной оценке.',
      interest: 'Категория совпадает с вашим запросом.', first_visit: 'Описание из источника ниже помогает понять, что это за место.',
      amenity: 'Есть свежие сведения об одном из выбранных удобств.', event: 'Событие указано в источнике на время предполагаемого посещения.' },
    activities: { stroll: 'Если доступ подтверждён, прогуляйтесь по общедоступной части территории.',
      observe: 'Если есть разрешённый публичный доступ, рассмотрите место и сделайте паузу.',
      museum_visit: 'Уточните доступ и билеты; если посещение возможно, выберите часть экспозиции для осмотра.',
      coffee_break: 'Уточните доступ и часы работы; если кафе принимает гостей, сделайте перерыв на кофе.',
      attend_event: 'Перепроверьте проведение и условия входа; если всё подтверждено, посетите событие.' },
    route: 'Расстояние по прямой; время — эвристическая оценка, не проверенный пешеходный маршрут.',
    hours: 'Актуальная доступность по часам работы неизвестна.', outside: 'Время визита не покрывается имеющимися интервалами расписания; уточните часы.',
    scheduled: 'По собранному расписанию время подходит; фактическое открытие не гарантируется.',
    access: 'Доступ на территорию не подтверждён; заранее уточните условия входа.',
    mobility: 'Сведения о доступности самого места не подтверждают доступность пути до него.',
    update: 'Дата обновления сведений самим источником неизвестна.',
    amenityUnknown: 'Нет свежего подтверждения удобства: ',
    assumption: 'По прямой × 1,3; скорость 4 км/ч (2,5 км/ч при ограничении мобильности); время визита — оценка.'
  },
  kk: {
    live: 'Осы баламалардың бірін таңдаңыз.', fallback: 'Тек деректерден іздеу: ЖИ генерациясы аяқталмады. Төмендегі идеялар үлгі бойынша берілген.',
    synthetic: 'Синтетикалық деректермен тест. Бұл нақты орындар туралы кеңес немесе live RAG емес.',
    empty: 'Осы шектеулерге сай расталған орындар табылмады. Радиусты, уақытты не міндетті сүзгіні өзгертіп көріңіз.',
    partial: 'Үштен аз нұсқа табылды; тізімге ойдан шығарылған орындар қосылған жоқ.',
    reasons: { nearby: 'Таңдалған нүктеге түзу сызық бойынша жақын.', fits_time: 'Көрсетілген есеп бойынша уақытыңызға сыяды.',
      interest: 'Санаты сұрауыңызға сәйкес келеді.', first_visit: 'Төмендегі дереккөз сипаттамасы бұл орын туралы түсінуге көмектеседі.',
      amenity: 'Таңдалған қолайлылықтардың бірі туралы жаңа дерек бар.', event: 'Дереккөзде іс-шара болжалды бару уақытында көрсетілген.' },
    activities: { stroll: 'Кіруге рұқсат расталса, аумақтың жалпыға ашық бөлігінде серуендеңіз.',
      observe: 'Жалпыға ашық кіру мүмкіндігі болса, орынды қарап, аздап демалыңыз.',
      museum_visit: 'Кіру мен билет шарттарын нақтылаңыз; мүмкіндік болса, көрменің бір бөлігін тамашалаңыз.',
      coffee_break: 'Кіру мен жұмыс уақытын нақтылаңыз; кафе қонақ қабылдаса, кофе ішіп демалыңыз.',
      attend_event: 'Іс-шараның өтетінін және кіру шарттарын қайта тексеріңіз; расталса, қатысыңыз.' },
    route: 'Қашықтық түзу сызықпен; уақыт — шамамен есеп, тексерілген жаяу бағыт емес.',
    hours: 'Жұмыс уақыты бойынша қазіргі қолжетімділік белгісіз.', outside: 'Бару уақыты қолдағы кесте аралықтарына сәйкес емес; уақытты нақтылаңыз.',
    scheduled: 'Жиналған кесте бойынша уақыт сәйкес келеді; нақты ашық болуы кепілденбейді.',
    access: 'Аумаққа кіру расталмаған; кіру шарттарын алдын ала нақтылаңыз.',
    mobility: 'Орынның қолжетімділігі оған баратын жолдың қолжетімділігін растамайды.',
    update: 'Дереккөздің ақпаратты жаңартқан күні белгісіз.',
    amenityUnknown: 'Қолайлылық туралы жаңа растау жоқ: ',
    assumption: 'Түзу қашықтық × 1,3; жылдамдық 4 км/сағ (қозғалыс шектеуі болса 2,5 км/сағ); бару уақыты шамамен.'
  },
  en: {
    live: 'Choose one of these alternatives.', fallback: 'Retrieval only: AI generation did not finish. Ideas below use templates.',
    synthetic: 'Synthetic test data. These are not real-place recommendations or live RAG.',
    empty: 'No evidenced options match these constraints. Try changing the radius, time or a required filter.',
    partial: 'Fewer than three suitable options were found; no places were invented to fill the list.',
    reasons: { nearby: 'Near the selected point in straight-line distance.', fits_time: 'Fits your time budget under the stated estimate.',
      interest: 'The category matches your request.', first_visit: 'The source description below explains what this place is.',
      amenity: 'Recent source evidence supports one of your selected amenities.', event: 'The source lists an event during your estimated visit.' },
    activities: { stroll: 'If access is confirmed, stroll through the publicly accessible part of the area.',
      observe: 'If there is permitted public access, take a look and pause here.',
      museum_visit: 'Check access and tickets; if visiting is possible, choose part of the exhibition to explore.',
      coffee_break: 'Check access and opening hours; if the cafe is receiving guests, take a coffee break.',
      attend_event: 'Recheck that the event is going ahead and confirm entry conditions before attending.' },
    route: 'Straight-line distance and heuristic time estimate, not a verified walking route.',
    hours: 'Current availability from opening hours is unknown.', outside: 'Your visit is outside the listed schedule intervals; check the hours.',
    scheduled: 'The collected schedule covers the visit; actual opening is not guaranteed.',
    access: 'Access to the site is unconfirmed; check entry conditions first.',
    mobility: 'Venue accessibility evidence does not establish an accessible route to it.',
    update: 'The publisher’s last update date is unknown.',
    amenityUnknown: 'No recent confirmation for amenity: ',
    assumption: 'Straight-line × 1.3; speed 4 km/h (2.5 km/h with a mobility constraint); visit duration is an estimate.'
  }
};
const ERRORS = {
  INVALID_INPUT: ['Проверьте координаты, запрос, время и фильтры.', 'Координаттарды, сұрауды, уақыт пен сүзгілерді тексеріңіз.', 'Check coordinates, request, time and filters.'],
  OUTSIDE_COVERAGE: ['Qadam пока поддерживает только район Астаны.', 'Qadam әзірге Астана аумағын ғана қолдайды.', 'Qadam currently covers the Astana area only.'],
  UNSUPPORTED_MODE: ['Сейчас поддерживаются только пешие прогулки.', 'Қазір тек жаяу серуен қолдау табады.', 'Only walking is supported at present.'],
  NEEDS_CLARIFICATION: ['Уточните ограничение в запросе. Для вылета укажите свободное время на прогулку и запас на дорогу; маршрут и прибытие не гарантируются.', 'Сұраудағы шектеуді нақтылаңыз. Ұшу алдында серуенге бос уақыт пен жолға уақыт қорын көрсетіңіз; жетуге кепілдік жоқ.', 'Please clarify the constraint. Before a flight, specify actual free walking time and a travel buffer; arrival cannot be guaranteed.'],
  PROVIDER_NOT_CONFIGURED: ['ИИ пока не подключён: требуется локальная настройка ключа и модели на сервере.', 'ЖИ әлі қосылмаған: серверде кілт пен модельді жергілікті баптау қажет.', 'AI is not connected yet: the server needs a local key and model configuration.'],
  DATA_UNAVAILABLE: ['Данные мест ещё не подключены или недоступны. Рекомендации не созданы.', 'Орындар деректері әлі қосылмаған немесе қолжетімсіз. Кеңестер жасалмады.', 'Place data is not connected or is unavailable. No recommendations were created.'],
  DATA_INVALID: ['Данные мест не прошли проверку. Неподтверждённые рекомендации скрыты.', 'Орындар деректері тексеруден өтпеді. Расталмаған кеңестер жасырылды.', 'Place data failed validation. Unverified recommendations were withheld.'],
  RETRIEVAL_TIMEOUT: ['Поиск не ответил вовремя. Попробуйте позже.', 'Іздеу уақытында жауап бермеді. Кейінірек қайталаңыз.', 'Retrieval timed out. Please try later.'],
  PROVIDER_TIMEOUT: ['ИИ не ответил вовремя. Попробуйте позже.', 'ЖИ уақытында жауап бермеді. Кейінірек қайталаңыз.', 'AI timed out. Please try later.'],
  PROVIDER_RATE_LIMIT: ['Лимит сервиса ИИ временно исчерпан. Попробуйте позже.', 'ЖИ қызметінің лимиті уақытша таусылды. Кейінірек қайталаңыз.', 'The AI service limit was reached. Please try later.'],
  PROVIDER_REFUSAL: ['ИИ не смог обработать запрос. Уточните цель прогулки.', 'ЖИ сұрауды өңдей алмады. Серуен мақсатын нақтылаңыз.', 'AI could not process this request. Clarify your walking goal.'],
  INVALID_MODEL_OUTPUT: ['Ответ ИИ не прошёл проверку. Попробуйте уточнить запрос.', 'ЖИ жауабы тексеруден өтпеді. Сұрауды нақтылап көріңіз.', 'The AI response failed validation. Try clarifying the request.'],
  PROVIDER_UNAVAILABLE: ['Сервис ИИ недоступен. Попробуйте позже.', 'ЖИ қызметі қолжетімсіз. Кейінірек қайталаңыз.', 'The AI service is unavailable. Please try later.'],
  BUSY: ['Другой запрос ещё обрабатывается. Попробуйте немного позже.', 'Басқа сұрау өңделіп жатыр. Сәл кейінірек қайталаңыз.', 'Another request is being processed. Please try shortly.'],
  INTERNAL_ERROR: ['Не удалось обработать запрос. Попробуйте позже.', 'Сұрауды өңдеу мүмкін болмады. Кейінірек қайталаңыз.', 'The request could not be processed. Please try later.']
};
export function errorResult(code, language = 'ru') {
  const lang = typeof language === 'string' && Object.hasOwn(COPY, language) ? language : 'ru';
  const safeCode = Object.hasOwn(ERRORS, code) ? code : 'INTERNAL_ERROR';
  return { status: safeCode === 'NEEDS_CLARIFICATION' ? 'needs_clarification' : 'error', code: safeCode,
    language: lang, message: ERRORS[safeCode][['ru','kk','en'].indexOf(lang)],
    context_used: null, recommendations: [], warnings: [] };
}
export function present(request, retrieval, generated, mode) {
  const copy = COPY[request.language];
  const recommendations = generated.recommendations.map(selection => {
    const c = retrieval.candidates.find(c => c.poi.id === selection.poi_id);
    const p = c.poi;
    const schedule = scheduledVisit(request, c);
    const caveats = [copy.route, schedule === 'scheduled' ? copy.scheduled : schedule === 'unknown' ? copy.hours : copy.outside];
    if (p.access.value !== 'public' || !freshEvidence(p, p.access.evidence_ids, request.now, 30)) caveats.push(copy.access);
    if (request.required_amenities.includes('wheelchair')) caveats.push(copy.mobility);
    if (p.source_updated_at === null) caveats.push(copy.update);
    for (const a of request.preferred_amenities) {
      if (p.amenities[a]?.value !== true || !freshEvidence(p, p.amenities[a].evidence_ids, request.now, 30)) caveats.push(copy.amenityUnknown + a);
    }
    // All factual fields/URLs come from the validated record, never the model.
    const sourceIds = new Set([...selection.evidence_ids,
      ...Object.values(p.amenities).flatMap(a => a.evidence_ids), ...p.access.evidence_ids,
      ...(p.opening_hours?.evidence_ids ?? []), ...(p.event?.evidence_ids ?? [])]);
    const sources = [{ url: p.source_url, attribution: p.attribution, collected_at: p.collected_at, source_updated_at: p.source_updated_at },
      ...p.evidence.filter(e => sourceIds.has(e.id)).map(e => ({ url: e.source_url, attribution: `${p.attribution} · ${e.source_field}`,
        collected_at: e.collected_at, source_updated_at: e.source_updated_at }))];
    return { poi_id: p.id, name: p.name, latitude: p.latitude, longitude: p.longitude,
      source_facts: { description: p.description, description_language: p.description_language, categories: p.categories,
        opening_hours: p.opening_hours?.text ?? null, collected_at: p.collected_at,
        amenities: Object.entries(p.amenities).map(([name,a]) => ({ name,
          value: freshEvidence(p, a.evidence_ids, request.now, 30) ? a.value : null })),
        event: p.event ? { starts_at: p.event.starts_at, ends_at: p.event.ends_at, status: p.event.status } : null },
      why: selection.reason_codes.map(code => copy.reasons[code]),
      activity: { text: copy.activities[selection.activity_code], kind: mode === 'retrieval_only' ? 'template_suggestion' : 'generated_idea' },
      estimates: { distance_m: Math.round(c.distance_m), travel_minutes: Math.ceil(c.travel_minutes_estimate),
        visit_minutes: c.visit_minutes_estimate, return_minutes: request.return_to_start ? Math.ceil(c.travel_minutes_estimate) : 0,
        buffer_minutes: request.buffer_minutes, total_minutes: Math.ceil(c.total_minutes_estimate),
        distance_kind: 'straight_line', assumptions: copy.assumption }, sources, caveats };
  });
  const synthetic = retrieval.dataset_kind === 'synthetic';
  return { status: synthetic ? 'synthetic_test' : mode, language: request.language,
    message: synthetic ? copy.synthetic : mode === 'live_rag' ? copy.live : mode === 'no_match' ? copy.empty : copy.fallback,
    context_used: { ...providerContext(request), location: 'manual_or_device_ephemeral', query_terms: request.query_terms },
    recommendations, warnings: [...retrieval.warnings, ...(recommendations.length > 0 && retrieval.candidates.length < 3 ? [copy.partial] : [])] };
}
export function fallbackSelections(request, candidates) {
  return { recommendations: candidates.slice(0, 3).map(c => ({ poi_id: c.poi.id,
    evidence_ids: c.poi.description_evidence_ids.slice(0, 3), reason_codes: ['nearby','fits_time'],
    activity_code: allowedActivities(request, c)[0] })) };
}
