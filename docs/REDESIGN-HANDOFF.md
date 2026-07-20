# Storefront Redesign — continuation prompt

Copy everything in the fenced block below into a fresh Claude Code session in this repo.

---

```
Continue the premium redesign of the rabea.art storefront. Read the full plan first:
C:\Users\mahmoud\.claude\plans\swirling-dazzling-hippo.md

## Repo state — read this before touching anything

`origin/main` is at 712ce05. My redesign work is NOT all on main:

  712ce05  fix(motion): every rb* animation was dead     <- ON origin/main
  4224c8d  feat(design): procedural texture system       <- on origin/audit/security-hardening ONLY

Commit 4224c8d landed on the wrong branch. A second agent was running a security-hardening
workstream against this same working tree and switched the checkout from `main` to
`audit/security-hardening` mid-session; my commit went onto that branch and is now buried under
its commits (82cd12e, af36324, 4fb5e71).

FIRST TASK: get 4224c8d onto main. Its parent is 712ce05, which is exactly main's tip, so it
fast-forwards cleanly — `git branch -f main 4224c8d && git push origin main`, or cherry-pick it.
Do NOT rebase or force-push the audit branch; it holds the other workstream's real work.

Before resuming, confirm no other agent is running against this directory. If one is, work on a
dedicated branch, because Phase 2 edits src/messages/{ar,en,he}.json and that workstream has
touched those exact files.

## What is already done

Phase 1.1 (712ce05):
- Fixed a site-wide bug: every rb* animation was dead. Lightning CSS scopes animation-name inside
  .module.css, so references to keyframes declared in the global tokens.css compiled to prefixed
  names matching nothing. The hero entrance, the three floating hero cards, the marquee, and the
  entrance animations on the custom wizard, order flow, legal, about, contact and coming-soon
  pages had never run a frame. Each of the 7 modules now declares its keyframes locally.
  `:global(name)` does NOT work in the `animation` shorthand — it emits invalid CSS. Don't retry it.
- Corrected --ease-standard from the keyword `ease` to cubic-bezier(0.22, 0.61, 0.36, 1).
- Added elevation (--shadow-1..6), fluid type, motion duration/easing, z-index and blur scales,
  and filled the holes in the spacing scale.

Phase 1.2 (4224c8d):
- src/styles/textures.css — procedural SVG/CSS textures (grain, paper-fiber, linen, canvas,
  weave-soft, stitch, thread, halftone, press, deckle mask) plus four --surface-* stacks.
  Exposed as :root custom properties on purpose: custom property VALUES are not scoped by CSS
  Modules, unlike animation-name.
- src/components/storefront/texture.ts — typed helpers (textured, fabricSwatch, canvasSurface,
  printSurface). tests/unit/texture.test.ts — 11 tests.
- body is now textured paper instead of a flat fill.
- ACCESSIBILITY: --color-sienna (#b7472a) is 4.68:1 on paper and 4.35:1 on textured paper — it
  fails AA as a text colour and always did. It is a FILL colour. Use --color-sienna-deep for
  sienna-coloured text and links (6.59:1 on textured paper). Texture opacity is capped at 0.035
  for this reason, not for taste. Honour this in every remaining phase.

## What is next

Phase 1.3 — src/components/decor/: TexturedSection, Ornament (inline SVG set), AmbientField,
Scene3D (perspective + preserve-3d depth stage), MaskReveal.

Phase 1.4 — motion/scroll.css using `animation-timeline: view()` behind @supports (the existing
IntersectionObserver Reveal stays as the Safari/Firefox fallback); useMagnetic.ts; extend
math.ts additively; add isLowPowerDevice() to env.ts.

Phase 2 — the ArtMarquee ribbon. Restructure the single pre-repeated `home.marq` string into a
phrase array in ar/en/he.json, then build dual counter-rotating rows, seamless loop, RTL-correct
phrases, ornament separators, linen texture, edge mask, hover pause, and a static wrapped list
under prefers-reduced-motion (today the global !important clamp freezes it mid-scroll).

Phases 3 and 4 — see the plan file.

## Constraints that will bite you

The E2E suite encodes contracts the redesign must not break. Full table is in the plan file; the
ones most easily violated: exactly one <h1> per page; the logo must be the first <a> inside
<header>; the product card must stay an <a href^="/product/"> as the outermost interactive
element; focus rings must use `outline` (not box-shadow); header nav must be reachable within 15
Tab presses; no horizontal overflow at 390px; zero console errors on static pages. Do not change
the Arabic strings the specs match on — new copy is additive.

tests/unit/product-art.test.ts pins grainedArt's composition order, so do not mutate GRAIN in
art.ts. tests/unit/motion-math.test.ts pins MAX_PARALLAX_SHIFT and the tiltAngles sign
convention, so extend math.ts additively.

KNOWN BAD TEST — fix it in Phase 4: tests/e2e/mobile.spec.ts:23 walks `xpath=..` from the product
link expecting the grid container, but the real DOM is `grid > div.tilt > a.card`, so it reads the
TiltCard wrapper, gets gridTemplateColumns "none", splits to length 1, and passes trivially. It
has never verified mobile column count. Fix the selector; if it then fails against the current
layout, that is a pre-existing responsive bug, not a regression.

## Verification

npm run typecheck / lint / test / build all pass as of 4224c8d (334 unit tests). Run all four
plus `npm run test:e2e` before each commit.

The in-app Browser pane did not work in the previous session — the tab stayed document.hidden and
screenshots timed out, so animations were throttled to a stopped clock. Two workarounds that did
work: drive animations directly via the Web Animations API (`el.getAnimations()[0].currentTime =
15000`, then read the computed transform), and decode SVG data-URIs with `new Image()` to prove
they are valid, since an invalid one paints nothing and reports no error. If the pane is still
broken, use Playwright, which drives its own browser.

Owner decisions already made: full freedom to diverge from the approved _design-reference mockups
including colours and type; NO animation libraries (no Framer Motion, GSAP, Lenis, R3F — extend
the existing CSS + rAF system); textures stay procedural; commit and push each phase.
```
