import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Simple, dependency-free PNG generator in pure Node.js
function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

function generatePNG(width, height, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw pixel data: each row has 1 filter byte (0) + width * 4 bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2;

  // Safe zone for maskable vs standard
  const cornerRadius = isMaskable ? 0 : width * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from corners for rounded squircle
      let inBounds = true;
      if (!isMaskable) {
        let dx = 0;
        let dy = 0;
        if (x < cornerRadius) dx = cornerRadius - x;
        else if (x > width - cornerRadius) dx = x - (width - cornerRadius);
        if (y < cornerRadius) dy = cornerRadius - y;
        else if (y > height - cornerRadius) dy = y - (height - cornerRadius);

        if (dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > cornerRadius) {
          inBounds = false;
        }
      }

      if (!inBounds) {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Background gradient from Indigo (79, 70, 229) to Violet (139, 92, 246)
      const gradT = (x + y) / (width + height);
      let r = Math.round(79 + gradT * (139 - 79));
      let g = Math.round(70 + gradT * (92 - 70));
      let b = Math.round(229 + gradT * (246 - 229));
      let a = 255;

      // Draw Thought / Speech Bubble shape
      const bubbleScale = isMaskable ? 0.72 : 0.85;
      const bCy = cy - height * 0.08 * bubbleScale;
      const bRadX = width * 0.32 * bubbleScale;
      const bRadY = height * 0.24 * bubbleScale;

      const normDx = (x - cx) / bRadX;
      const normDy = (y - bCy) / bRadY;
      const distEllipse = normDx * normDx + normDy * normDy;

      // Soundwave bars below bubble
      const barY = cy + height * 0.22 * bubbleScale;
      const barWidth = width * 0.035 * bubbleScale;
      const isSoundBar =
        [-2, -1, 0, 1, 2].some((barIdx) => {
          const barX = cx + barIdx * (barWidth * 1.6);
          const barHeight = (height * [0.08, 0.15, 0.20, 0.15, 0.08][barIdx + 2]) * bubbleScale;
          return (
            Math.abs(x - barX) <= barWidth / 2 &&
            Math.abs(y - barY) <= barHeight / 2
          );
        });

      if (distEllipse <= 1.0) {
        // Inside white thought bubble
        r = 255;
        g = 255;
        b = 255;

        // Sparkle in center of thought bubble
        const spDx = Math.abs(x - cx) / (width * 0.09 * bubbleScale);
        const spDy = Math.abs(y - bCy) / (height * 0.09 * bubbleScale);
        if (spDx + spDy <= 1.0) {
          // Sparkle color: indigo
          r = 79;
          g = 70;
          b = 229;
        }
      } else if (isSoundBar) {
        // Soundwave white bars
        r = 255;
        g = 255;
        b = 255;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate all standard PWA resolutions
console.log('Generating PWA icons...');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePNG(180, 180, false));
console.log('Successfully generated all PWA icons in /public.');
