# Permissions Matrix — rabea.art

## Roles

Defined in `prisma/schema.prisma:39-43`, ranked in `src/lib/auth/requireRole.ts:16-20`:

| Role | Rank | Assignment | Notes |
|---|---|---|---|
| `OWNER` | 2 | Manual (`scripts/create-owner.ts`) or promoted by another OWNER | ≥1 active OWNER enforced transactionally |
| `ADMIN` | 1 | Invited and promoted by an OWNER | Full catalog and settings control |
| `STAFF` | 0 | **Default for every new row** (`schema.prisma:78`) | Order operations only |
| *anonymous* | — | Public storefront visitor | No account system exists for customers |

Comparison is `roleRank[admin.role] >= roleRank[required]` — roles are cumulative, not disjoint.

**OWNER vs ADMIN differ by exactly one capability: admin-user management.** OWNER has no other
exclusive power. Verified by enumerating all 25 server actions and 9 route handlers.

---

## Resource permission matrix

Legend: ✅ allowed · ❌ denied · — not applicable

| Resource | Action | anon | STAFF | ADMIN | OWNER | Enforced at |
|---|---|:--:|:--:|:--:|:--:|---|
| **Storefront catalog** | read | ✅ | ✅ | ✅ | ✅ | public by design |
| **Order** | create | ✅ | ✅ | ✅ | ✅ | `POST /api/orders` — rate-limited, no auth by design |
| | read (own) | ❌ | — | — | — | no customer accounts exist |
| | read (all) | ❌ | ✅ | ✅ | ✅ | `requireAdminPage()` · `orders/page.tsx:42` |
| | update status | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `orders/[id]/actions.ts:97` |
| | update payment | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `:160` — raised from STAFF, see PM-04 |
| | set final price | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `:196` — raised from STAFF, see PM-04 |
| | set ETA | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `:232` |
| | archive | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `:259` |
| | hard delete | ❌ | ❌ | ❌ | ❌ | **no delete path exists anywhere** |
| | internal note | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `:292` |
| | record WhatsApp | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `:329` |
| | CSV export | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `orders/export/route.ts:33` |
| **Customer** | read | ❌ | ✅ | ✅ | ✅ | `requireAdminPage()` · `customers/page.tsx:59` |
| | edit notes | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `customers/[id]/actions.ts:40` |
| | delete | ❌ | ❌ | ❌ | ❌ | **no delete path — see DB-08** |
| | CSV export (with addresses) | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `customers/export/route.ts:26` |
| **Product** | read | ✅ | ✅ | ✅ | ✅ | public storefront |
| | create / update | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `products/actions.ts:55,79` |
| | delete | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `:109` |
| | archive | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `:281` |
| **Product image** | upload (signed URL) | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `product-images/sign/route.ts:39` |
| **Options** (sizes, colours, frames, materials, methods) | all mutations | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `options/actions.ts` ×11 |
| **Settings** | read | ✅ | ✅ | ✅ | ✅ | storefront reads WhatsApp/announcement |
| | update | ❌ | ❌ | ✅ | ✅ | `requireRole(ADMIN)` · `settings/actions.ts:26` |
| **Order file** | upload (signed URL) | ✅ | ✅ | ✅ | ✅ | `POST /api/uploads/sign` — rate-limited, anon by design |
| | download | ❌ | ✅ | ✅ | ✅ | `requireRole(STAFF)` · `files/[fileId]/route.ts:25` — 120s signed redirect |
| **Admin user** | list | ❌ | ❌ | ❌ | ✅ | `requireRole(OWNER)` · `users/page.tsx:24` |
| | invite | ❌ | ❌ | ❌ | ✅ | `requireRole(OWNER)` · `users/actions.ts:77` |
| | change role | ❌ | ❌ | ❌ | ✅ | `requireRole(OWNER)` · `:119` |
| | activate / deactivate | ❌ | ❌ | ❌ | ✅ | `requireRole(OWNER)` · `:149` |
| | log out (self) | — | ✅ | ✅ | ✅ | ungated by design — must work for a deactivated admin |
| **Reports** | view | ❌ | ✅ | ✅ | ✅ | `requireAdminPage()` · `reports/page.tsx:81` |
| **Cron cleanup** | invoke | ❌ | ❌ | ❌ | ❌ | `CRON_SECRET` via `timingSafeEqual` — no role can call it |

---

## Assessment

### Strengths (verified, not assumed)

- **Complete coverage.** All 25 server actions, all 5 admin route handlers, and all 13 admin
  pages gate before any privileged read or write. I enumerated them individually; there are no
  gaps.
- **Immediate revocation.** `requireRole` re-reads the `AdminUser` row on every request rather
  than trusting a JWT role claim, so deactivating an account takes effect on the next request with
  no stale-token window. This is stricter than most implementations.
- **Race-safe owner floor.** `assertOwnerFloorNotBroken` runs its `count` *inside* the same
  transaction as the role change (`users/actions.ts:48-55`), so two concurrent demotions cannot
  both pass the check and leave the system ownerless.
- **Uniform failure mode.** `AuthError` maps to `{ ok: false, error: "FORBIDDEN" }` everywhere; no
  stack traces or internal codes reach the client.
- **Audit trail.** Every admin mutation writes an `AuditLog` row in the same transaction, and both
  CSV exports log `action: "csv.export"` — so PII extraction is attributable.

### Weaknesses

| ID | Issue | Severity |
|---|---|---|
| PM-01 | **All staff see all orders and all customer PII.** There is no per-order assignment or ownership model. Appropriate for a single studio; revisit if staff grows or contractors are added. | Low (by design) |
| PM-02 | **`/api/admin/files/[fileId]` has no ownership scoping** — any STAFF may fetch any file by id. Consistent with PM-01, but it means a leaked file id is usable by any staff account. | Low |
| PM-03 | **Validation runs before authorization** in most actions (e.g. `users/actions.ts:72-77`). No DB write is reachable, but an unauthenticated caller can use the endpoints as an input-shape oracle. | Informational |
| PM-04 | ~~**STAFF can set final prices and payment status.**~~ **RESOLVED** — both raised to `requireRole(ADMIN)` (`orders/[id]/actions.ts:160,196`). The UI now also disables both controls for STAFF and explains why, so the boundary reads as deliberate rather than as a broken page. Operational actions (status, ETA, archive, notes, WhatsApp) correctly remain STAFF. | ~~Medium~~ Fixed |
| PM-05 | **New users default to STAFF** (`schema.prisma:78`), which per PM-04 includes pricing authority. The default should be the least useful role, not a moderately powerful one. | Medium |
| PM-06 | **No customer-facing accounts**, so customers cannot view or delete their own data. Combined with DB-08 (no deletion path at all), an erasure request has no implementation. | Medium |
| PM-07 | **`lastLoginAt` is never written** despite being displayed — the admin user list always shows "n/a", so there is no signal for spotting a compromised or dormant account. | Low |

### Recommended changes

1. ~~Raise `updateFinalPriceAction` and `updateOrderPayAction` to `requireRole(ADMIN)`~~ — **done.**
2. **Write `lastLoginAt`** on successful login (PM-07) — the column and the UI already exist.
3. **Implement a customer erasure path** (PM-06/DB-08): either a soft-delete column with PII
   nulling, or an OWNER-only hard delete that reassigns orders to an anonymised customer record.
4. Leave PM-01/PM-02 as they are — per-order ownership is real complexity that a single-studio
   operation does not need, and the audit log already provides attribution.
