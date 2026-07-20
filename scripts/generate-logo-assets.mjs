/**
 * One-off: turn the supplied logo.jpg (flat #DEDBD6 background) into the asset set the site
 * needs — a background-free full lockup, a header-sized mark, and favicon/social images.
 * Run from the repo root: node <this file>
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve("design/logo-source.jpg");
const PUB = path.resolve("public");
const APP = path.resolve("src/app");

/** Background colour sampled from the source corners. */
const BG = { r: 0xde, g: 0xdb, b: 0xd6 };
/** How far a pixel may drift from BG and still count as background. Generous enough to catch
 * the JPEG's paper texture and compression noise, tight enough to keep the pale arch line-art. */
const TOLERANCE = 26;

/** Replace near-background pixels with transparency, keeping anti-aliased edges by scaling
 * alpha with distance rather than hard-thresholding (avoids jagged haloes around the script). */
async function toTransparent(input) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8ClampedArray(data);
  const ch = info.channels;

  for (let i = 0; i < px.length; i += ch) {
    const d = Math.sqrt(
      (px[i] - BG.r) ** 2 + (px[i + 1] - BG.g) ** 2 + (px[i + 2] - BG.b) ** 2,
    );
    if (d <= TOLERANCE) {
      px[i + 3] = 0;
    } else if (d < TOLERANCE * 2.2) {
      // Feather zone: ramp alpha so edge pixels blend instead of stair-stepping.
      px[i + 3] = Math.round(((d - TOLERANCE) / (TOLERANCE * 1.2)) * 255);
    }
  }

  return sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: ch } })
    .png();
}

async function main() {
  await mkdir(PUB, { recursive: true });

  // 1. Full lockup, background removed and trimmed to its ink.
  const transparent = await toTransparent(SRC);
  const fullBuf = await transparent.toBuffer();
  await sharp(fullBuf)
    .trim({ threshold: 1 })
    .resize({ width: 1200, withoutEnlargement: true })
    // Palette quantisation: this is line art in a handful of greys, so an indexed PNG is a
    // fraction of the truecolour size with no visible loss.
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(path.join(PUB, "logo.png"));
  console.log("wrote public/logo.png");

  const meta = await sharp(path.join(PUB, "logo.png")).metadata();
  console.log(`  full lockup: ${meta.width}x${meta.height}`);

  // 2. The signature + pen mark alone (top portion of the lockup, above the name block).
  //    Measured from the source: ink starts ~14% down and the name block begins ~57% down.
  const src = sharp(SRC);
  const { width: sw, height: sh } = await src.metadata();
  const markCrop = {
    left: Math.round(sw * 0.1),
    top: Math.round(sh * 0.12),
    width: Math.round(sw * 0.82),
    height: Math.round(sh * 0.46),
  };
  const markRaw = await sharp(SRC).extract(markCrop).toBuffer();
  const markTransparent = await toTransparent(markRaw);
  await sharp(await markTransparent.toBuffer())
    .trim({ threshold: 1 })
    .resize({ height: 240, withoutEnlargement: true })
    // Palette quantisation: this is line art in a handful of greys, so an indexed PNG is a
    // fraction of the truecolour size with no visible loss.
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(path.join(PUB, "logo-mark.png"));
  const markMeta = await sharp(path.join(PUB, "logo-mark.png")).metadata();
  console.log(`wrote public/logo-mark.png (${markMeta.width}x${markMeta.height})`);

  // 3. Favicon: the mark on the brand paper colour, square, padded so it reads at 32px.
  const markForIcon = await sharp(path.join(PUB, "logo-mark.png"))
    .resize({ width: 400, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: "#F6F0E3" },
  })
    .composite([{ input: markForIcon, gravity: "center" }])
    .png()
    .toFile(path.join(APP, "icon.png"));
  console.log("wrote src/app/icon.png (favicon, 512x512)");

  await sharp({
    create: { width: 180, height: 180, channels: 4, background: "#F6F0E3" },
  })
    .composite([
      {
        input: await sharp(path.join(PUB, "logo-mark.png"))
          .resize({ width: 150, fit: "inside" })
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toFile(path.join(APP, "apple-icon.png"));
  console.log("wrote src/app/apple-icon.png (180x180)");

  // 4. Social share card (Open Graph), full lockup centred on brand paper.
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: "#F6F0E3" },
  })
    .composite([
      {
        input: await sharp(path.join(PUB, "logo.png"))
          .resize({ height: 430, fit: "inside" })
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toFile(path.join(PUB, "og-image.png"));
  console.log("wrote public/og-image.png (1200x630)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
