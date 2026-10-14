const fs = require('fs');
const path = require('path');

const sizes = [16, 24, 32, 48, 64, 128, 256];
const tempDir = path.resolve('d:/Code/Const/apps/learn/desktop/build/.ico_temp');
const outIco = path.resolve('d:/Code/Const/apps/learn/desktop/build/icon.ico');

const images = sizes.map(sz => {
  const filePath = path.join(tempDir, `${sz}.png`);
  const buf = fs.readFileSync(filePath);
  return { width: sz, height: sz, buffer: buf };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type 1 = icon
header.writeUInt16LE(images.length, 4);

let offset = 6 + 16 * images.length;
const dirEntries = [];
for (const img of images) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
  entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(img.buffer.length, 8); // size
  entry.writeUInt32LE(offset, 12); // offset
  dirEntries.push(entry);
  offset += img.buffer.length;
}

const finalIco = Buffer.concat([header, ...dirEntries, ...images.map(img => img.buffer)]);
fs.writeFileSync(outIco, finalIco);
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Successfully created squircle icon.ico with sizes:', sizes.join(', '));
