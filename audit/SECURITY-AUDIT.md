# Security Audit — rabea.art

**Date:** 2026-07-20 · **Commit:** `ec8d610` · **Method:** static review of the full codebase plus
non-destructive probing of the live production deployment.

---

## Headline

The application's own security engineering is **above average and in several places genuinely
strong**. What fails is the perimeter around it: the database's outer door (PostgREST) is open,
and nothing is watching for failures.

Two live exposures were confirmed by probing production. One is now fixed in code; the other
requires a dashboard action only you can take.

---

## 1. Authentication assessment — ⚠️ WARNING

Supabase Auth, password grant, cookie sessions via `@supabase/ssr`. Admin-only; customers have no
accounts.

**Correct:**
- Sign-in is client-side, then `router.refresh()` hands the cookie to the server (`LoginForm.tsx:45-56`).
- **No account enumeration** — the Supabase error is discarded and a fixed message shown (`:49-53`).
- **Open-redirect guard** on `?next=` rejects absolute and protocol-relative URLs (`login/page.tsx:17`).
- Edge session check uses `getClaims()`, which performs **local JWT signature verification** — not
  a cookie-presence check, so it is not spoofable.
- Logout is deliberately ungated so a deactivated admin can still end their session.

**Findings:**

| ID | Finding | Severity |
|---|---|---|
| AUTH-01 | **No application-level brute-force protection.** `schema.prisma:439` documents the intended `"login:<ip>"` bucket key, but `grep "login:"` across `src/` returns zero code matches — `checkRateLimit` is never called on an auth path. The only defence is Supabase's project-wide limit. | **High** |
| AUTH-04 | `AdminUser.lastLoginAt` declared (`schema.prisma:80`) and rendered (`UsersView.tsx:114`) but never written — no last-login signal for detecting compromise. | Low |
| AUTH-05 | No MFA on admin accounts. Supabase supports TOTP; for accounts with full customer-PII export rights this is worth enabling. | Medium |

## 2. Authorization assessment — ✅ PASS

See `PERMISSIONS-MATRIX.md` for the full matrix. Summary: all 25 server actions, 5 admin route
handlers and 13 admin pages gate correctly; the role check re-reads the database per request so
revocation is immediate; the owner-floor invariant is transactionally race-safe.

The one substantive concern is **PM-04** — STAFF, the default role for every new invitee, can set
final prices and payment status. Recommend raising those two actions to ADMIN.

## 3. RLS assessment — ❌ CRITICAL

Full analysis in `DATABASE-RLS-MATRIX.md`.

**RLS is disabled on all 22 tables and there are no policies anywhere.** The documented rationale
("the browser never talks to Postgres") is factually true of the application but does not address
the actual threat: the anon key is public by construction and ships in the `/admin/login` bundle.
With the Data API enabled, that key reads every table directly — including `customers`, which
holds names, phones, WhatsApp numbers, emails and street addresses.

Currently masked only because the coming-soon gate suppresses the login bundle. **That protection
ends the moment you launch.**

Remediation is written and ready: `docs/rls-lockdown.sql`, plus removing `public` from Supabase's
exposed schemas. Either alone closes it; do both.

## 4. API security — ⚠️ WARNING (was CRITICAL)

### Confirmed live exposure — now fixed

The coming-soon gate excluded `/api/**` from its matcher (`proxy.ts:114`), so while every page
returned the holding page, the public write endpoints were reachable. Verified against production:

```
POST https://www.rabea.art/api/orders       → 400 VALIDATION_FAILED
POST https://www.rabea.art/api/uploads/sign → 400 INVALID_FILE
GET  https://www.rabea.art/api/cron/cleanup-uploads → 401   ✅ correctly protected
GET  https://www.rabea.art/api/admin/orders/export  → 401   ✅ correctly protected
```

Anyone could write into production `orders`/`customers`. **Fixed:** public API paths are now in
the matcher and refused with `503` + `Retry-After` while gated; admin API routes stay reachable
because they self-gate. Covered by 15 tests in `tests/unit/coming-soon-gate.test.ts`.

**Action for you:** inspect `orders`/`customers` for junk rows created before this fix.

### Route inventory

| Route | Auth | Validation | Rate limit |
|---|---|---|---|
| `POST /api/orders` | none (by design) | Zod | 5 / 600s ✅ |
| `POST /api/uploads/sign` | none (by design) | Zod | 30 / 600s ✅ |
| `POST /api/uploads/verify` | none (by design) | Zod | 60 / 600s ✅ |
| `GET|POST /api/cron/cleanup-uploads` | `CRON_SECRET`, constant-time | n/a | n/a |
| `GET /api/admin/files/[fileId]` | `requireRole(STAFF)` | path id | ❌ none |
| `GET /api/admin/orders/export` | `requireRole(ADMIN)` | parsed query | ❌ none |
| `GET /api/admin/orders/[id]/export` | `requireRole(ADMIN)` | path id | ❌ none |
| `GET /api/admin/customers/export` | `requireRole(ADMIN)` | parsed query | ❌ none |
| `POST /api/admin/product-images/sign` | `requireRole(ADMIN)` | Zod | ❌ none |

**Order submission is the standout.** Client prices are not merely rejected — they are
*structurally impossible*: no price field exists in any item schema, so Zod's default key-stripping
silently discards any `unitPrice` an attacker adds, and every price is re-derived from a fresh DB
read (`submit.ts:113,156`). Consents use `z.literal(true)` so they cannot be forged false.
Idempotency is backed by a unique constraint with a `P2002` catch rather than a read-then-write.

## 5. Storage security — ⚠️ WARNING

**Correct:** object keys are server-minted UUIDs so the client filename never reaches the path
(path traversal is unreachable); `/api/uploads/verify` re-reads size and MIME **server-side** and
deletes the object on failure; SVG is deliberately excluded from the allowlist with a documented
XSS rationale; signed download URLs are 60–120s.

| ID | Finding | Severity |
|---|---|---|
| API-02 | `bucketPath` was validated only by `startsWith("order-uploads/")`, letting a caller attach arbitrary paths to their own order — DB pollution, and a storage-pinning primitive against the cleanup cron. **FIXED** — now a strict `order-uploads/{uuid}/{uuid}.{ext}` regex with 7 new tests. | Medium |
| API-03 | No content sniffing. `verify` re-reads the Content-Type the *uploader supplied on the PUT*, so arbitrary bytes can be stored labelled `image/png`. Bounded by `nosniff` + private bucket. | Low |
| DB-04 | `product-images` has **no orphan cleanup at all** — an admin who uploads then navigates away leaks objects permanently. | Medium |
| STO-01 | **UNVERIFIED:** that `order-uploads` is actually private in the dashboard. A public setting would expose customer reference photos. | Must check |

## 6. Secret management — ✅ PASS

**No secret has ever been committed.** Verified three independent ways across all 21 commits:

```
git log --all --full-history -- .env .env.local .env.production  → empty
git ls-files | grep -i env  → .env.example, src/lib/env.ts, src/components/motion/env.ts
git check-ignore -v .env .env.local  → both ignored
```

- Service-role key is `server-only` guarded (`supabase/admin.ts:1`) — a client import is a **build
  error**, not a runtime leak.
- Never `NEXT_PUBLIC_`-prefixed; `.env.example:15` carries an explicit warning.
- `src/lib/env.ts` Zod-validates infra vars at boot and aggregates failures into one readable
  error, with a documented build-phase bypass (`instrumentation.ts:9`).
- CI uses **zero secrets by design** — a fork PR cannot exfiltrate anything.

Residual: `COMING_SOON` / `PREVIEW_KEY` are absent from the `env.ts` schema (HOST-04), so a typo
silently leaves the site gated. It fails closed, but silently.

## 7. Dependency risks — ⚠️ WARNING

```
$ npm audit
5 moderate severity vulnerabilities
```

| Advisory | Path | Fix |
|---|---|---|
| `GHSA-qx2v-qp2m-jg93` — postcss XSS via unescaped `</style>` | `next` → `postcss` | Only via `npm audit fix --force`, which downgrades to `next@9.3.3` — **not acceptable** |
| `@hono/node-server` | `prisma` → `@prisma/dev` | Dev-time dependency, not in the production bundle |

Both are transitive and not independently fixable. **Accepted and now tracked**: CI gates at
`--audit-level=high` (so this stays green) and separately prints the full report unconditionally
so the moderates stay on the record. Dependabot config added.

## 8. OWASP-related findings

| Category | Assessment |
|---|---|
| A01 Broken Access Control | ⚠️ App-layer is ✅ PASS; **database layer is ❌ CRITICAL** (SEC-01). API-01 was a real live instance, now fixed. |
| A02 Cryptographic Failures | ✅ HSTS confirmed live (`max-age=63072000`); constant-time comparison for both `CRON_SECRET` and (now) `PREVIEW_KEY`. |
| A03 Injection | ✅ No raw SQL except one parameterised `$queryRaw`. React escapes output; no `dangerouslySetInnerHTML` anywhere. |
| A04 Insecure Design | ⚠️ Rate limiter fails open by design — defensible, now alertable. |
| A05 Security Misconfiguration | ❌ RLS off; ⚠️ no CSP; ✅ `X-Powered-By` now removed; ✅ image host now pinned. |
| A06 Vulnerable Components | ⚠️ 5 moderate transitives, documented above. |
| A07 Auth Failures | ⚠️ No brute-force protection (AUTH-01); no MFA (AUTH-05). |
| A08 Data Integrity Failures | ✅ Transactional writes; idempotency via unique constraint. |
| A09 Logging Failures | ⚠️ Audit trail is excellent; **operational alerting is absent** (LOG-01). |
| A10 SSRF | ✅ No user-supplied URL is ever fetched server-side. Image `remotePatterns` wildcard (a near-SSRF proxy vector) is now pinned. |

**Checked and not found:** SQL injection, XSS sinks, CSRF (Server Actions are origin-checked and
cookies are `SameSite=Lax`), open redirects (guarded), path traversal (UUID keys), command
injection (no shell execution), insecure deserialization (JSON only), clickjacking
(`X-Frame-Options: DENY`), MIME sniffing (`nosniff`), permissive CORS (no CORS headers set — same
origin only).

## 9. Security headers — live verification

```
$ curl -sSI https://www.rabea.art/
Strict-Transport-Security: max-age=63072000          ✅ (Vercel-provided — comment was correct)
X-Frame-Options: DENY                                ✅
X-Content-Type-Options: nosniff                      ✅
Referrer-Policy: strict-origin-when-cross-origin     ✅
Permissions-Policy: camera=(), microphone=(), …      ✅
X-Powered-By: Next.js                                ❌ → FIXED (poweredByHeader: false)
Content-Security-Policy                              ❌ absent
```

**HSTS correction:** `next.config.ts:7` asserts "Vercel already serves HSTS", and I flagged that as
an unverified assumption during review. Probing production **confirms the comment is right** —
`max-age=63072000` is served at both apex and `www`. It lacks `includeSubDomains` and `preload`,
which is a hardening opportunity, not a gap.

**CSP (SEC-02) remains open.** Deferred deliberately rather than rushed: a nonce-based policy must
thread through `proxy.ts`, and this app composes three middleware branches (coming-soon, admin
gate, next-intl), so a careless implementation breaks rendering. Worth noting that this app is an
unusually *easy* CSP target — zero third-party scripts and self-hosted `next/font` — so the
`next.config.ts` comment somewhat overstates the difficulty. Recommended path: `Report-Only`
first, E2E coverage, then enforce.

## 10. Rate limiting — see `FINDINGS.md` RL-01…RL-04

The critical issue was **RL-01**: `clientIp` took the *first* `x-forwarded-for` entry with no
proxy validation, in three copy-pasted implementations. One header per request defeated every
limit in the application.

**FIXED** — extracted to `src/lib/client-ip.ts`, which prefers Vercel's unspoofable
`x-vercel-forwarded-for`, falls back to the **last** XFF hop on Vercel, and refuses to trust the
header at all off-Vercel. 14 unit tests cover the spoofing cases directly.

Still open: no limit on login (AUTH-01), admin exports, or `product-images/sign`; the read-then-
write is non-transactional so bursts are soft; 429 responses carry no `Retry-After`.

## 11. File upload security — ⚠️ WARNING

Covered in §5. Net position: strong on the parts that matter most (server-minted keys, server-side
metadata re-read, SVG excluded, size and count caps, private bucket, short-lived signed URLs);
weak on content sniffing and on `product-images` lifecycle.

## 12. Webhook security — n/a

There are no inbound webhooks. The only scheduled ingress is the Vercel cron endpoint, which is
the **best-authenticated endpoint in the repository**: `timingSafeEqual` with a length pre-check,
accepting both `x-cron-secret` and Vercel's `Authorization: Bearer`, failing closed when
`CRON_SECRET` is unset, with the secret schema-enforced to ≥16 characters.

Replay protection is not implemented, but the operation is idempotent and bounded
(`MAX_DELETIONS_PER_RUN = 500`), so replay is harmless.

---

## Security remediation plan

### Phase 0 — before removing the coming-soon gate

| # | Action | Effort | Verification |
|---|---|---|---|
| 1 | Run `docs/rls-lockdown.sql` | 5 min | Verification query returns 22 × `rls_enabled = t` |
| 2 | Remove `public` from Supabase exposed schemas | 2 min | `curl` PostgREST with anon key returns no rows |
| 3 | Confirm `order-uploads` bucket is private | 2 min | Dashboard → Storage |
| 4 | Audit `orders`/`customers` for junk from the pre-fix open API | 15 min | Manual review |
| 5 | Deploy this branch; re-probe that public API returns 503 | 10 min | `curl -X POST /api/orders` |

### Phase 1 — first week after launch

| # | Action | Finding |
|---|---|---|
| 6 | Rate-limit `/admin/login` using the existing limiter and its documented `login:<ip>` key | AUTH-01 |
| 7 | Enable TOTP MFA for OWNER and ADMIN accounts | AUTH-05 |
| 8 | Raise `updateFinalPriceAction` / `updateOrderPayAction` to `requireRole(ADMIN)` | PM-04 |
| 9 | Ship CSP in `Report-Only`, add E2E coverage, then enforce | SEC-02 |
| 10 | Write `lastLoginAt` on successful login | AUTH-04 |

### Phase 2 — first month

| # | Action | Finding |
|---|---|---|
| 11 | Extend the cleanup cron to `product-images` | DB-04 |
| 12 | Add magic-byte content sniffing at `/api/uploads/verify` | API-03 |
| 13 | Rate-limit admin exports and `product-images/sign` | RL-03 |
| 14 | Add `Retry-After` to 429 responses; make the limiter's read-then-write transactional | RL-04 |
| 15 | Implement a customer erasure path | DB-08 / PM-06 |
| 16 | Add `includeSubDomains; preload` to HSTS | — |
