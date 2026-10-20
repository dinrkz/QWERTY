// Explicit maintenance operation: fetch public, pinned library assets only.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const directory = new URL('../../public/vendor/leaflet/', import.meta.url);
const assets = [
  ['leaflet.js', 'dist/leaflet.js', '20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='],
  ['leaflet.css', 'dist/leaflet.css', 'p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='],
  ['LICENSE.txt', 'LICENSE', null],
];
const downloaded = [];
for (const [name, remote, expected] of assets) {
  const response = await fetch(`https://unpkg.com/leaflet@1.9.4/${remote}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('ASSET_DOWNLOAD_FAILED');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 250000 || expected && createHash('sha256').update(bytes).digest('base64') !== expected) throw new Error('ASSET_INTEGRITY_FAILED');
  if (!expected && !bytes.toString().includes('Redistribution and use')) throw new Error('LICENSE_INVALID');
  downloaded.push([name, bytes]);
}
await mkdir(directory, { recursive: true });
for (const [name, bytes] of downloaded) await writeFile(new URL(name, directory), bytes);
console.log(`Vendored Leaflet 1.9.4 assets in ${fileURLToPath(directory)}; no keys or place data used.`);
