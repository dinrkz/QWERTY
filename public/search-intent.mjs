// Small, local vocabulary helper, not an unrestricted language interpreter.
const words = value => value.toLowerCase().normalize('NFKC');
export function interpretSearch(text) {
  const q = words(text);
  if (/(?:wi[ -]?fi|вай.?фай|халяль|халал|веган|gluten|глютен|глютенсіз|veggie|diet|диет|баспалдақ|stairs|ступен|лестниц|\d+\s*(?:km|км|метр\p{L}*|meters?|metres?|m)\b)/u.test(q)) return { clarification: true };
  if (/(?:\b(?:no|not|without|except|instead|flight|airport|vegan|halal|budget|book|taxi|drive)\b|\b\d+\s*(?:₸|тг|тенге)|(?:^|\s)(?:не|без|кроме|вместо|дешев|бюджет|вылет|аэропорт|брон|такси)|емес|әуежай)/u.test(q)) return { clarification: true };
  const groups = [
    ['coffee', ['cafe'], /(?:^|[^\p{L}])(?:coffee|cafe|café|кофе\p{L}*|кафе|кофехана)(?:$|[^\p{L}])/u],
    ['walk', ['park'], /(?:^|[^\p{L}])(?:park\p{L}*|парк\p{L}*|саябақ\p{L}*)(?:$|[^\p{L}])/u],
    ['discover', ['museum'], /(?:^|[^\p{L}])(?:museum\p{L}*|музе\p{L}*|мұражай\p{L}*)(?:$|[^\p{L}])/u],
    ['discover', ['park', 'museum', 'landmark'], /(?:sights|sightseeing|достопримечательност|көрікті|first visit|впервые)/u],
  ];
  const found = groups.filter(([, , pattern]) => pattern.test(q));
  if (found.length > 1) return { clarification: true };
  const result = found.length ? { scenario: found[0][0], categories: found[0][1] } : {};
  if (!found.length && /(?:\bwalk\b|прогул|погуля|серуен)/u.test(q)) { result.scenario = 'walk'; result.categories = ['park', 'landmark']; }
  const durations = [...q.matchAll(/(?:^|\s)(\d{1,3})\s*(minutes?|mins?|минут\p{L}*|мин|hours?|час\p{L}*|сағат)(?=$|[^\p{L}])/gu)];
  if (/\d+\s*[-–]\s*\d+\s*(?:мин|час|minute|hour|сағат)/u.test(q)
    || (!durations.length && /\d+\s*(?:мин|час|minute|hour|сағат)/u.test(q))) return { clarification: true };
  if (durations.length > 1 || /\d+[.,]\d+\s*(?:час|hour|сағат)/u.test(q)) return { clarification: true };
  if (durations.length) { const [, amount, unit] = durations[0]; result.minutes = Number(amount) * (/hour|час|сағат/u.test(unit) ? 60 : 1);
    if (result.minutes < 5 || result.minutes > 480) return { clarification: true }; }
  result.amenities = [];
  if (/socket|outlet|розетк/u.test(q)) result.amenities.push('sockets');
  if (/quiet|тих|тыныш/u.test(q)) result.amenities.push('quiet');
  if (/wheelchair|коляск|арбамен/u.test(q)) result.amenities.push('wheelchair');
  if (/child|kid|реб[её]н|дет|бала/u.test(q)) result.amenities.push('child_friendly');
  result.open = /open now|открыт|ашық/u.test(q);
  result.firstVisit = /first visit|впервые|алғаш/u.test(q);
  return result;
}
