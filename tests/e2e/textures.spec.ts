import { expect, test } from "@playwright/test";

/**
 * Guards the texture system against the failure mode that has now bitten this project twice:
 * CSS that is invalid in the context it is used, dropped silently by the browser, leaving a
 * surface that paints nothing while every computed value still reads correct.
 *
 * `--texture-halftone` was originally written with `background` SHORTHAND syntax
 * (`radial-gradient(...) 0 0 / 7px 7px`). That is illegal inside `background-image`, which is
 * how printSurface() and the composed --surface-* stacks consume it, so two homepage tiles
 * rendered blank. No error, no warning.
 *
 * The check: assign every texture and surface to `background-image` in a live browser and read
 * it back. An invalid value round-trips as "none" — a valid one does not.
 */

const TEXTURES = [
  "grain",
  "paper-fiber",
  "linen",
  "canvas",
  "weave-soft",
  "stitch",
  "stitch-sienna",
  "thread",
  "halftone",
  "press",
  "deckle",
];

const SURFACES = ["paper", "linen-band", "canvas", "ink"];

test("every texture is a valid background-image value", async ({ page }) => {
  await page.goto("/");

  const broken = await page.evaluate((names) => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const bad: string[] = [];
    for (const n of names) {
      const declared = getComputedStyle(document.documentElement)
        .getPropertyValue(`--texture-${n}`)
        .trim();
      if (!declared) {
        bad.push(`${n}: not declared`);
        continue;
      }
      probe.style.backgroundImage = "";
      probe.style.backgroundImage = declared;
      // The browser refuses an invalid value, leaving the property at its initial "none".
      if (getComputedStyle(probe).backgroundImage === "none") {
        bad.push(`${n}: invalid as background-image`);
      }
    }
    probe.remove();
    return bad;
  }, TEXTURES);

  expect(broken).toEqual([]);
});

test("every composed surface is a valid background-image value", async ({ page }) => {
  await page.goto("/");

  const broken = await page.evaluate((names) => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const bad: string[] = [];
    for (const n of names) {
      const declared = getComputedStyle(document.documentElement)
        .getPropertyValue(`--surface-${n}`)
        .trim();
      if (!declared) {
        bad.push(`${n}: not declared`);
        continue;
      }
      probe.style.backgroundImage = "";
      probe.style.backgroundImage = declared;
      if (getComputedStyle(probe).backgroundImage === "none") {
        bad.push(`${n}: invalid as background-image`);
      }
    }
    probe.remove();
    return bad;
  }, SURFACES);

  expect(broken).toEqual([]);
});

test("every SVG-based texture actually decodes", async ({ page }) => {
  await page.goto("/");

  // A malformed SVG data-URI is also silent: the background simply never paints.
  const failures = await page.evaluate(async (names) => {
    const bad: string[] = [];
    for (const n of names) {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(`--texture-${n}`)
        .trim();
      const m = raw.match(/url\((["']?)(.*?)\1\)/);
      if (!m) continue; // gradient-based textures have nothing to decode
      const ok = await new Promise<boolean>((res) => {
        const img = new Image();
        img.onload = () => res(img.naturalWidth > 0);
        img.onerror = () => res(false);
        img.src = m[2];
      });
      if (!ok) bad.push(n);
    }
    return bad;
  }, TEXTURES);

  expect(failures).toEqual([]);
});
