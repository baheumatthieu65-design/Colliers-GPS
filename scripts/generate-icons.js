import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Generate raw minimal valid PNGs for PWA icons
function createPngBuffer(width, height, r, g, b) {
  // Header
  const signature = Buffer.from([139, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit
  ihdr.writeUInt8(2, 9); // Truecolor RGB
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace
  
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT raw pixels
  const rowSize = width * 3 + 1;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      // Add slight border/inner square effect for icon
      const isMargin = x < width * 0.1 || x > width * 0.9 || y < height * 0.1 || y > height * 0.9;
      if (isMargin) {
        rawData[pxOffset] = Math.min(255, r + 30);
        rawData[pxOffset + 1] = Math.min(255, g + 30);
        rawData[pxOffset + 2] = Math.min(255, b + 30);
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function run() {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Color #5A6F4E -> R: 90, G: 111, B: 78
  const p192 = await createPngBuffer(192, 192, 90, 111, 78);
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), p192);

  const p512 = await createPngBuffer(512, 512, 90, 111, 78);
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), p512);

  const apple = await createPngBuffer(180, 180, 90, 111, 78);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), apple);

  const maskable = await createPngBuffer(512, 512, 62, 74, 53);
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable);

  console.log('PNG Icons generated successfully!');
}

run();
