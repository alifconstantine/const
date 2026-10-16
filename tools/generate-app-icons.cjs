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
const FAVICON_SVG_PATH = path.join(ROOT, "apps/learn/web/public/favicon.svg");

// 1. SVGs
const CIRCLE_SVG = fs.readFileSync(FAVICON_SVG_PATH, "utf-8");

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
  console.log("==> Building Desktop Windows/Linux icons for Learn and Harness...");
  const desktopDirs = [
    path.join(ROOT, "apps/learn/desktop/build"),
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

  // Also copy to public/icon.png for favicon in both desktop apps
  const publicDirs = [
    path.join(ROOT, "apps/learn/desktop/public"),
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

async function buildAndroidIcons() {
  console.log("==> Building Android Mobile icons...");
  const resDir = path.join(ROOT, "apps/learn/mobile/android/app/src/main/res");

  // 1. ic_launcher_background.xml
  const valuesDir = path.join(resDir, "values");
  const bgXmlPath = path.join(valuesDir, "ic_launcher_background.xml");
  fs.writeFileSync(
    bgXmlPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#141413</color>\n</resources>\n`,
    "utf-8"
  );
  console.log("    ✓ updated ic_launcher_background.xml -> #141413");

  // 2. Mipmap launcher icons
  const densities = [
    { name: "mdpi", launcher: 48, fg: 108 },
    { name: "hdpi", launcher: 72, fg: 162 },
    { name: "xhdpi", launcher: 96, fg: 216 },
    { name: "xxhdpi", launcher: 144, fg: 324 },
    { name: "xxxhdpi", launcher: 192, fg: 432 },
  ];

  for (const d of densities) {
    const targetDir = path.join(resDir, `mipmap-${d.name}`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // ic_launcher.png (squircle)
    const squircleBuf = await sharp(Buffer.from(SQUIRCLE_SVG))
      .resize(d.launcher, d.launcher)
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(targetDir, "ic_launcher.png"), squircleBuf);

    // ic_launcher_round.png (circle)
    const roundBuf = await sharp(Buffer.from(CIRCLE_SVG))
      .resize(d.launcher, d.launcher)
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(targetDir, "ic_launcher_round.png"), roundBuf);

    // ic_launcher_foreground.png (adaptive foreground)
    const fgBuf = await sharp(Buffer.from(FOREGROUND_SVG))
      .resize(d.fg, d.fg)
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(targetDir, "ic_launcher_foreground.png"), fgBuf);

    console.log(`    ✓ mipmap-${d.name}: launcher(${d.launcher}x${d.launcher}), fg(${d.fg}x${d.fg})`);
  }

  // Remove leftover vector drawable that might override mipmap adaptive foreground
  const obsoleteVectorFg = path.join(resDir, "drawable-v24/ic_launcher_foreground.xml");
  if (fs.existsSync(obsoleteVectorFg)) {
    fs.unlinkSync(obsoleteVectorFg);
    console.log("    ✓ removed obsolete robot-head drawable-v24/ic_launcher_foreground.xml");
  }

  // 3. Splash screens
  console.log("==> Building Android Splash Screens...");
  const splashTargets = [
    { dir: "drawable", w: 480, h: 320 },
    { dir: "drawable-port-mdpi", w: 320, h: 480 },
    { dir: "drawable-port-hdpi", w: 480, h: 800 },
    { dir: "drawable-port-xhdpi", w: 720, h: 1280 },
    { dir: "drawable-port-xxhdpi", w: 960, h: 1600 },
    { dir: "drawable-port-xxxhdpi", w: 1280, h: 1920 },
    { dir: "drawable-land-mdpi", w: 480, h: 320 },
    { dir: "drawable-land-hdpi", w: 800, h: 480 },
    { dir: "drawable-land-xhdpi", w: 1280, h: 720 },
    { dir: "drawable-land-xxhdpi", w: 1600, h: 960 },
    { dir: "drawable-land-xxxhdpi", w: 1920, h: 1280 },
  ];

  for (const s of splashTargets) {
    const dirPath = path.join(resDir, s.dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Emblem size: roughly 26% of shortest dimension
    const emblemSize = Math.max(72, Math.round(Math.min(s.w, s.h) * 0.26));
    const emblemPng = await sharp(Buffer.from(CIRCLE_SVG))
      .resize(emblemSize, emblemSize)
      .png()
      .toBuffer();

    const splashBuf = await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: { r: 20, g: 20, b: 19, alpha: 1 }, // #141413
      },
    })
      .composite([
        {
          input: emblemPng,
          top: Math.round((s.h - emblemSize) / 2),
          left: Math.round((s.w - emblemSize) / 2),
        },
      ])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(dirPath, "splash.png"), splashBuf);
    console.log(`    ✓ ${s.dir}/splash.png (${s.w}x${s.h}, emblem ${emblemSize}px)`);
  }
}

async function main() {
  try {
    await buildDesktopIcons();
    await buildAndroidIcons();
    console.log("\nAll icons generated successfully!");
  } catch (err) {
    console.error("Fatal error generating icons:", err);
    process.exit(1);
  }
}

main();
