/**
 * Génère un paquet de tuiles d'orthophoto IGN hors-ligne autour d'Ilhet (65).
 * Node 18+ requis (fetch natif).
 *
 * Usage:
 *   node scripts/download-offline-ortho.mjs
 *
 * Le niveau maximal est volontairement limité à 13 pour garder une taille
 * raisonnable sur un téléphone. La BD ORTHO est diffusée par l'IGN.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const CENTER = { lat: 42.9200, lon: 0.3900 };
const RADIUS_KM = 30;
const MIN_ZOOM = 8;
const MAX_ZOOM = 13;
const OUTPUT = path.resolve('public/offline-maps/ign-ortho');
const CONCURRENCY = 8;

const tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * 2 ** z);
};
const tileCenter = (x, y, z) => {
  const n = 2 ** z;
  const lon = x / n * 360 - 180;
  const lat = 180 / Math.PI * Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  return { lat, lon };
};
const haversineKm = (a, b) => {
  const R = 6371;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function ensureDir(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}

async function downloadOne(z, x, y) {
  const file = path.join(OUTPUT, String(z), String(x), `${y}.jpg`);
  try {
    await fs.access(file);
    return 'skip';
  } catch {}

  const url = `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureDir(file);
  await fs.writeFile(file, buffer);
  return 'download';
}

async function main() {
  let jobs = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const latDelta = RADIUS_KM / 111.32;
    const lonDelta = RADIUS_KM / (111.32 * Math.cos(CENTER.lat * Math.PI / 180));
    const minX = tileX(CENTER.lon - lonDelta, z);
    const maxX = tileX(CENTER.lon + lonDelta, z);
    const minY = tileY(CENTER.lat + latDelta, z);
    const maxY = tileY(CENTER.lat - latDelta, z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (haversineKm(CENTER, tileCenter(x, y, z)) <= RADIUS_KM + 1.5) {
          jobs.push([z, x, y]);
        }
      }
    }
  }

  console.log(`Téléchargement de ${jobs.length} tuiles IGN (zoom ${MIN_ZOOM}-${MAX_ZOOM})...`);
  let done = 0;
  let downloaded = 0;
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const job = queue.shift();
      if (!job) return;
      const [z, x, y] = job;
      try {
        const result = await downloadOne(z, x, y);
        if (result === 'download') downloaded++;
      } catch (error) {
        console.error(`Échec z${z}/${x}/${y}:`, error.message);
      } finally {
        done++;
        if (done % 25 === 0 || done === jobs.length) console.log(`${done}/${jobs.length}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`Terminé : ${downloaded} nouvelles tuiles téléchargées.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
