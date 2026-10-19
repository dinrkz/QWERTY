export const CATEGORIES = ['park', 'museum', 'landmark', 'cafe', 'event'];
export const AMENITIES = ['sockets', 'quiet', 'child_friendly', 'wheelchair'];
export const LANGUAGES = ['ru', 'kk', 'en'];
export const REASONS = ['nearby', 'fits_time', 'interest', 'first_visit', 'amenity', 'event'];
export const ACTIVITIES = ['stroll', 'observe', 'museum_visit', 'coffee_break', 'attend_event'];
export const POLICY = Object.freeze({ earth_radius_m: 6371000, detour_factor: 1.3,
  walking_m_per_minute: 4000 / 60, reduced_m_per_minute: 2500 / 60,
  visit_minutes: { park: 20, museum: 45, landmark: 15, cafe: 25, event: 30 },
  freshness_days: { hours: 7, event: 2, amenity: 30, access: 30 } });

export class AppError extends Error {
  constructor(code) { super(code); this.name = 'AppError'; this.code = code; }
}
export function distanceMetres(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad)
    * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 2 * POLICY.earth_radius_m * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function estimates(request, poi) {
  const distance_m = distanceMetres(request, poi);
  const speed = request.required_amenities.includes('wheelchair')
    ? POLICY.reduced_m_per_minute : POLICY.walking_m_per_minute;
  const travel_minutes_estimate = distance_m * POLICY.detour_factor / speed;
  const visit_minutes_estimate = Math.max(...poi.categories.map(c => POLICY.visit_minutes[c]));
  return { distance_m, distance_kind: 'straight_line', travel_minutes_estimate, visit_minutes_estimate,
    total_minutes_estimate: travel_minutes_estimate * (request.return_to_start ? 2 : 1)
      + visit_minutes_estimate + request.buffer_minutes };
}
export function detectLanguage(text = '', selected = 'auto') {
  if (LANGUAGES.includes(selected)) return selected;
  if (/[әғқңөұүһі]/iu.test(text)) return 'kk';
  return /[а-яё]/iu.test(text) ? 'ru' : 'en';
}
export function validInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const time = Date.parse(value);
  // Reject calendar overflow (e.g. February 30), even where Date.parse normalizes it.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return Number.isFinite(time) && month >= 1 && month <= 12 && day >= 1
    && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function freshEvidence(poi, ids, now, days) {
  return ids.length > 0 && ids.every(id => {
    const e = poi.evidence.find(item => item.id === id);
    if (!e) return false;
    const date = Math.min(Date.parse(e.collected_at), e.source_updated_at ? Date.parse(e.source_updated_at) : Infinity);
    const age = Date.parse(now) - date;
    return age >= 0 && age <= days * 86400000;
  });
}
export function scheduledVisit(request, candidate) {
  const hours = candidate.poi.opening_hours;
  if (!hours || !freshEvidence(candidate.poi, hours.evidence_ids, request.now, POLICY.freshness_days.hours)) return 'unknown';
  const start = Date.parse(request.now) + candidate.travel_minutes_estimate * 60000;
  const end = start + candidate.visit_minutes_estimate * 60000;
  return hours.intervals.some(i => Date.parse(i.start) <= start && Date.parse(i.end) >= end)
    ? 'scheduled' : (hours.intervals.length ? 'outside_listed_intervals' : 'unknown');
}
export function eventFits(request, candidate) {
  const event = candidate.poi.event;
  if (!event || event.status !== 'scheduled'
    || !freshEvidence(candidate.poi, event.evidence_ids, request.now, POLICY.freshness_days.event)) return false;
  const start = Date.parse(request.now) + candidate.travel_minutes_estimate * 60000;
  return Date.parse(event.starts_at) <= start
    && Date.parse(event.ends_at) >= start + candidate.visit_minutes_estimate * 60000;
}
export function allowedActivities(request, candidate) {
  const p = candidate.poi;
  return p.categories.flatMap(c => ({ park: ['stroll', 'observe'], landmark: ['observe'],
    museum: ['museum_visit'], cafe: ['coffee_break'], event: eventFits(request, candidate) ? ['attend_event'] : [] })[c]);
}
export function allowedReasons(request, candidate) {
  return ['nearby', 'fits_time', ...(request.categories.some(c => candidate.poi.categories.includes(c)) ? ['interest'] : []),
    ...(request.first_visit ? ['first_visit'] : []),
    ...([...request.required_amenities, ...request.preferred_amenities].some(a => candidate.poi.amenities[a]?.value === true
      && freshEvidence(candidate.poi, candidate.poi.amenities[a].evidence_ids, request.now, 30)) ? ['amenity'] : []),
    ...(eventFits(request, candidate) ? ['event'] : [])];
}
