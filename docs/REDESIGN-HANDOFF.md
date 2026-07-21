# Storefront Redesign — continuation prompt

Copy everything in the fenced block below into a fresh Claude Code session in this repo.

---

```
Continue the premium redesign of the rabea.art storefront (github.com/MahmoudSghayer/rabeaArt).

    git checkout main && git pull

main is at accea10, clean and synced. Baseline: typecheck clean, lint 0 errors, 369 unit tests,
build succeeds, ~140 E2E passing on chromium-desktop + mobile.

## What is already done — do NOT redo any of this

Phase 1.1 (712ce05) — Fixed a site-wide bug: EVERY rb* animation was dead. Lightning CSS scopes
animation-name inside .module.css, so references to keyframes declared in the global tokens.css
compiled to prefixed names matching nothing. The hero entrance, floating cards, marquee and the
entrance animations on six other pages had never run a frame. Each module now declares its
keyframes locally. `:global(name)` does NOT work in the `animation` shorthand — it emits invalid
CSS. Also corrected --ease-standard from the keyword `ease` to cubic-bezier(0.22,0.61,0.36,1),
and added elevation/type/motion/z-index/blur scales plus the missing spacing steps.

Phase 1.2 (c4efd73) — src/styles/textures.css: 10 procedural SVG/CSS textures + 4 composed
--surface-* stacks, exposed as :root custom properties (those are NOT scoped by CSS Modules,
unlike animation-name). src/components/storefront/texture.ts has typed helpers. body is textured
paper instead of a flat fill.

Phase 1.3 (b95553f) — src/components/decor/: TexturedSection, Ornament (10 glyphs), Scene3D +
SceneLayer (perspective/preserve-3d depth staging, the "3D without WebGL" answer), MaskReveal,
AmbientField. Plus the repo's first component tests locking their a11y contract.

Phase 2 (543868b) — ArtMarquee: the homepage strip was one pre-baked string typed out three
times on a flat fill, and it never moved. Now a structured phrase array in ar/en/he.json driving
two counter-rotating rows on linen, with ornament separators, edge-fade mask, hover pause, and a
static wrapped list under reduced motion.

Phase 3.2 (710b29a) — Homepage: material bands, asymmetric 3-up categories (the custom-order
tile is new), ordering steps as a connected <ol> with a stitched connector and per-step ornament,
and a composed empty state.

Phase 3.3-3.7 (ced5ebd) — shop, product, custom, order, about, contact, legal, plus header and
footer. Shop opens on a textured category band with sticky glass controls. Product's gallery is a
real material with frame depth; its pill column is split into three panels; the related rail gets
its own band. Custom has a five-beat storyboard where the material advances with the story, and
UploadDropzone got a stitched seam, drag-over lift and progress drawn as a seam being sewn. Order's
confirmation went from five identical boxes to three tiers. About runs a real thread down its
timeline. Contact's four cards got distinct accent/watermark identities and the FAQ finally
animates open. Legal got a sticky margin TOC and struck numeral medallions.

Phase 4 partial (accea10) — tests/e2e/mobile.spec.ts. The whole file had been skipped behind
E2E_HAS_DB including three checks that never needed a database, so mobile had zero CI coverage;
and its grid check resolved to the TiltCard wrapper, got gridTemplateColumns "none", and passed
unconditionally. Both fixed, plus a third fault it exposed: the hamburger check was broken from
the day it was written (strict-mode violation — "المتجر" matches header AND footer). Overflow
coverage went from 2 routes to all 8.

## What is left

1. COPY KEYS the redesign wants but could not add (new translation keys were out of scope for the
   parallel agents). Add to src/messages/{ar,en,he}.json:
   - a heading for the custom storyboard, and a clearer "choose your piece" label for its beat 2
     (it currently reuses "نوع الطلب / Request type")
   - about.valuesTitle — the values band is an unlabelled region in the heading outline
   - legal.toc — would let the sticky TOC be a properly named <nav> landmark instead of an
     unnamed <aside>
   - three short product panel labels (roughly "اختر قطعتك" / "أتمم طلبك" / "تفاصيل"); they are
     currently distinguished only by a corner ornament
   - optionally a reply-time line for the Contact hours card, the only card with no third line,
     so it renders shorter than its neighbours

2. PHASE 1.4 motion polish, deliberately deferred: motion/scroll.css using
   `animation-timeline: view()` behind @supports (the existing IntersectionObserver Reveal stays
   as the Safari/Firefox fallback); useMagnetic.ts for primary CTAs; isLowPowerDevice() in env.ts
   to gate expensive effects; extend math.ts additively with unit tests.

3. SEEDED-DATA VERIFICATION. /shop and /product only ever render their empty and unavailable
   states locally because the dev DB has placeholder credentials. The populated product grid,
   pagination, and the related rail with real products have never been seen. Run against a seeded
   DB with E2E_HAS_DB=1 and look at them.

4. HOUSEKEEPING: two stale git worktrees under .claude/worktrees/ (keen-dirac-bb9ef6,
   sweet-brattain-988c64) are left over from background tasks. `npm run lint` scans them, which is
   why the one pre-existing ProductForm warning is reported three times. `git worktree remove`
   them once you confirm nothing there is wanted.

## The rule that matters most

Three separate bugs shipped this session where CSS failed SILENTLY while every computed value
read correct. Do not trust computed styles as proof that something renders:

- Keyframes referenced from a .module.css but declared globally → animation never runs.
- MaskReveal's mask polarity was inverted → tiles rendered blank at opacity 1, correct
  dimensions, correct background-image.
- --texture-halftone carried `background` SHORTHAND syntax (`... 0 0 / 7px 7px`), which is
  illegal inside background-image → the whole declaration was dropped, artwork layers included.

INVARIANT, now enforced by tests/unit/texture.test.ts and tests/e2e/textures.spec.ts: every
--texture-* / --surface-* value must be a bare <image> — a url() or gradient with NO position or
size attached. Size at the point of use with background-size.

So: verify by SCREENSHOT. Start the dev server, write a throwaway Playwright spec, scroll
gradually (an instant scrollTo outruns IntersectionObserver), screenshot, and actually LOOK at
the image with the Read tool. Delete the throwaway spec afterwards.

## Other constraints that will bite

- --color-sienna (#b7472a) FAILS WCAG AA as a text colour: 4.68:1 on paper, 4.35:1 on textured
  paper. It is a FILL colour. Use --color-sienna-deep for sienna text and links (6.59:1).
- E2E contracts: exactly one <h1> per page; header/main/footer landmarks; the logo must be the
  first <a> inside <header>; product cards stay an <a href^="/product/"> as the outermost
  interactive element; focus rings must use `outline`, not box-shadow; header nav reachable
  within 15 Tab presses; no horizontal overflow at 390px; zero console errors on static pages;
  custom wizard step pills must render the literal "1 · …"; colour swatches keep both `title` and
  `aria-pressed`.
- tests/unit/product-art.test.ts pins grainedArt's composition order — do not mutate GRAIN.
  tests/unit/motion-math.test.ts pins MAX_PARALLAX_SHIFT and the tiltAngles sign convention —
  extend math.ts additively.
- TexturedSection's glow sits BEHIND .inner (z-index 0) and the band carries overflow: clip, so
  edge="deckle" paints the surrounding page colour inward rather than bleeding outward.
- `test.use({ reducedMotion: "reduce" })` silently does nothing in this repo's Playwright setup.
  Use `page.emulateMedia({ reducedMotion: "reduce" })`.
- Run the full E2E with --workers=2 or fewer. The dev server returns intermittent 500s under
  heavier parallelism, which reads as flake; re-run any failure in isolation before believing it.

## Owner decisions already made — do not re-ask

Full freedom to diverge from the approved _design-reference mockups, including colours and type.
NO animation libraries — no Framer Motion, GSAP, Lenis or R3F; extend the existing CSS + rAF
system in src/components/motion/. Textures stay procedural. Commit and push each phase to main.

## Seeing it live

https://rabea.art still serves the coming-soon page: in production every route rewrites there
unless COMING_SOON=0. To preview without opening the site publicly, set PREVIEW_KEY in the Vercel
env to a long random string, redeploy, then visit https://rabea.art/?preview=<key> once — a
30-day cookie keeps the bypass. Leave COMING_SOON alone.
```
