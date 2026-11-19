const path = require("path");
const fs = require("fs");

// Load sharp from pnpm store
let sharp;
try {
  sharp = require("../node_modules/.pnpm/node_modules/sharp");
} catch {
  sharp = require("sharp");
}

const ROOT = path.resolve(__dirname, "..");

const SQUIRCLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <clipPath id="const-squircle-clip">
      <path fill-rule="evenodd" d="M432 72C250 36 40 136 40 256C40 376 250 476 432 440C320 384 180 320 180 256C180 192 320 128 432 72Z"/>
    </clipPath>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="104" ry="104" fill="#141413"/>
  <g transform="translate(256 256) scale(0.80) translate(-256 -256) translate(23, -35.5)">
    <g transform="translate(512 0) scale(-1 1) rotate(32 256 256)" clip-path="url(#const-squircle-clip)" fill="#FAF9F5">
      <rect x="-60" y="38" width="632" height="60"/>
      <rect x="-60" y="113" width="632" height="60"/>
      <rect x="-60" y="188" width="632" height="60"/>
      <rect x="-60" y="264" width="632" height="60"/>
      <rect x="-60" y="339" width="632" height="60"/>
      <rect x="-60" y="414" width="632" height="60"/>
    </g>
  </g>
</svg>
`.trim();

// Adaptive foreground (108dp viewport, safe zone center diameter ~66dp)
const FOREGROUND_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
  <defs>
    <clipPath id="const-fg-clip">
      <path fill-rule="evenodd" d="M432 72C250 36 40 136 40 256C40 376 250 476 432 440C320 384 180 320 180 256C180 192 320 128 432 72Z"/>
    </clipPath>
  </defs>
  <g transform="translate(24, 21.5) scale(0.127)">
    <g transform="translate(256 256) scale(0.80) translate(-256 -256) translate(23, -35.5)">
      <g transform="translate(512 0) scale(-1 1) rotate(32 256 256)" clip-path="url(#const-fg-clip)" fill="#FAF9F5">
        <rect x="-60" y="38" width="632" height="60"/>
        <rect x="-60" y="113" width="632" height="60"/>
        <rect x="-60" y="188" width="632" height="60"/>
        <rect x="-60" y="264" width="632" height="60"/>
        <rect x="-60" y="339" width="632" height="60"/>
        <rect x="-60" y="414" width="632" height="60"/>
      </g>
    </g>
  </g>
</svg>
`.trim();

// Helper to assemble multi-resolution ICO file
function createIco(pngBuffersWithSizes) {
  const count = pngBuffersWithSizes.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type (1)
  header.writeUInt16LE(count, 4); // image count

  const dirEntries = [];
  const imageBuffers = [];

  for (const item of pngBuffersWithSizes) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // color palette count (0 = no palette)
    entry.writeUInt8(0, 3); // reserved (0)
    entry.writeUInt16LE(1, 4); // color planes (1)
    entry.writeUInt16LE(32, 6); // bits per pixel (32 for RGBA)
    entry.writeUInt32LE(item.buffer.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data

    dirEntries.push(entry);
    imageBuffers.push(item.buffer);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

async function buildDesktopIcons() {
  console.log("==> Building Desktop Windows/Linux icons for Harness...");
  const desktopDirs = [
    path.join(ROOT, "apps/harness/desktop/build"),
  ];

  for (const desktopBuildDir of desktopDirs) {
    if (!fs.existsSync(desktopBuildDir)) {
      fs.mkdirSync(desktopBuildDir, { recursive: true });
    }

    // 1. icon.png (512x512)
    const icon512 = await sharp(Buffer.from(SQUIRCLE_SVG)).resize(512, 512).png().toBuffer();
    fs.writeFileSync(path.join(desktopBuildDir, "icon.png"), icon512);

    // 2. icon-1024.png
    const icon1024 = await sharp(Buffer.from(SQUIRCLE_SVG)).resize(1024, 1024).png().toBuffer();
    fs.writeFileSync(path.join(desktopBuildDir, "icon-1024.png"), icon1024);

    // 3. icon.ico with all standard resolutions
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const icoItems = [];
    for (const size of icoSizes) {
      const buf = await sharp(Buffer.from(SQUIRCLE_SVG)).resize(size, size).png().toBuffer();
      icoItems.push({ width: size, height: size, buffer: buf });
    }
    const icoBuffer = createIco(icoItems);
    fs.writeFileSync(path.join(desktopBuildDir, "icon.ico"), icoBuffer);

    console.log(`    ✓ ${path.relative(ROOT, desktopBuildDir)}: icon.png, icon-1024.png, icon.ico`);
  }

  // Also copy to public/icon.png for favicon in desktop app
  const publicDirs = [
    path.join(ROOT, "apps/harness/desktop/public"),
  ];
  for (const pDir of publicDirs) {
    if (!fs.existsSync(pDir)) {
      fs.mkdirSync(pDir, { recursive: true });
    }
    const pubIcon = await sharp(Buffer.from(SQUIRCLE_SVG)).resize(512, 512).png().toBuffer();
    fs.writeFileSync(path.join(pDir, "icon.png"), pubIcon);
  }
}

async function main() {
  try {
    await buildDesktopIcons();
    console.log("\nAll icons generated successfully!");
  } catch (err) {
    console.error("Fatal error generating icons:", err);
    process.exit(1);
  }
}

main();
