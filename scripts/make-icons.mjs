import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url));
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

await sharp(svg).resize(192, 192).png().toFile(decodeURIComponent(out('icon-192.png')));
await sharp(svg).resize(512, 512).png().toFile(decodeURIComponent(out('icon-512.png')));

// Maskable: Motiv kleiner auf vollflächigem Hintergrund (Safe Zone)
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#5f6899' } })
  .composite([{ input: inner, left: 76, top: 76 }])
  .png()
  .toFile(decodeURIComponent(out('icon-512-maskable.png')));
console.log('icons done');
