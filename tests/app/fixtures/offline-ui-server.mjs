// Browser verification only: clearly authored synthetic POIs, no saved records.
import '../../../scripts/app/offline-network-guard.mjs';
import { createAppServer } from '../../../src/server.mjs';
import { createOfflineService } from '../../../src/app/offline.mjs';
import { estimates } from '../../../src/shared/policy.mjs';
import { envelope, expected } from './private-envelope.mjs';

const retrieve = async request => {
  const e = envelope(request), c = e.result.candidates[0];
  if (!request.categories.includes('cafe')) {
    Object.assign(c.poi, { name: 'Synthetic park <not markup>', categories: ['park'], source_categories: ['park'] });
    c.uncertainty_codes = ['area_point_not_entrance', 'description_missing'];
    Object.assign(c, estimates(request, c.poi));
  } else {
    c.poi.source_categories = ['coffee_point'];
    c.poi.source_rubrics = [{ id: '58871', name: 'Synthetic takeaway rubric' }];
    c.uncertainty_codes = ['coffee_point_seating_unknown', 'description_missing'];
  }
  if (request.require_open || request.events_only || request.required_amenities.length
    || c.total_minutes_estimate > request.available_minutes || c.distance_m > request.max_distance_m) {
    Object.assign(e.result, { candidates: [], eligible_count: 0, status: 'no_match' });
  }
  return e;
};
// Optional map preview exercises the real UI with synthetic places. The imported
// network guard blocks server-side OpenAI/routing calls; browser OSM tiles can load.
const mapPreview = process.argv.includes('--map-preview');
const port = mapPreview ? 3004 : 3001;
const server = createAppServer({ config: { mode: mapPreview ? 'bounded' : 'offline', generation: { enabled: false },
  command: ['synthetic-not-executed'], expected },
  recommend: createOfflineService({ retrieve, expected, now: () => '2026-10-19T00:00:00Z' }) });
server.listen(port, '127.0.0.1', () => process.stdout.write(`Synthetic UI check: http://127.0.0.1:${port}\n`));
