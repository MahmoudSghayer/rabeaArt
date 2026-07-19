# Supabase & Resend setup (operator guide)

This is a one-time manual setup checklist for the Storage buckets, cron job, and transactional
email provider used by the upload pipeline (`src/lib/storage/uploads.ts`,
`src/app/api/uploads/*`, `src/app/api/cron/cleanup-uploads`) and the email layer
(`src/lib/email/*`). None of this is created automatically by the app — the app assumes it
already exists at runtime.

## 1. Storage buckets

Two buckets are required:

| Bucket           | Access  | Contents                                             |
| ----------------- | ------- | ----------------------------------------------------- |
| `order-uploads`   | Private | Customer reference photos/logos staged during checkout |
| `product-images`  | Public  | Admin-managed product photos                          |

### Dashboard steps

1. Supabase Dashboard → your project → **Storage**.
2. **New bucket** → name `order-uploads` → **Public bucket** = OFF → Create.
3. **New bucket** → name `product-images` → **Public bucket** = ON → Create.

### SQL alternative

Run in the SQL editor (or via `psql`/migration) instead of the dashboard UI:

```sql
insert into storage.buckets (id, name, public)
values
  ('order-uploads', 'order-uploads', false),
  ('product-images', 'product-images', true);
```

### Bucket policies

**No storage RLS policies are needed for either bucket.** The app never talks to Storage from
the browser with the anon key — every read/write goes through server-only Route Handlers using
`createSupabaseAdminClient()` (`src/lib/supabase/admin.ts`), which authenticates with the
`service_role` key and bypasses RLS entirely. Do not add an anon/public storage policy on
`order-uploads` — it holds customer-submitted files and must stay reachable only via
server-signed URLs (`createSignedUploadUrl` for uploads, `createSignedUrl` for admin downloads).

`product-images` is a public bucket only in the sense that `getPublicUrl()` works for its
objects; write access should still go through the admin-managed product pages, not a public
storage policy.

### Canonical path format (read before writing any code that touches `OrderFile.bucketPath`)

- `src/lib/storage/uploads.ts` functions take/return **bucket-relative** paths, e.g.
  `"3fa8.../f47ac10b-....jpg"` (no bucket name) — that's what `.storage.from(bucket)...` expects
  once a bucket is already selected.
- The `OrderFile.bucketPath` column stores the **full path including the bucket name**, e.g.
  `"order-uploads/3fa8.../f47ac10b-....jpg"`.
- Convert between the two with `toOrderUploadsBucketPath` / `fromOrderUploadsBucketPath`
  (exported from `src/lib/storage/uploads.ts`) — never concatenate the bucket name by hand.

### Cleanup rule

A staged object under `order-uploads/{draftId}/...` is an **orphan** if and only if:

1. it is older than 24 hours (Storage's own `created_at`), **and**
2. no `OrderFile` row exists with that exact (canonical, bucket-prefixed) `bucketPath`.

The cleanup cron (below) deletes orphans. It never touches an object younger than 24h, so a
customer mid-checkout is never at risk of losing an in-progress upload.

## 2. Scheduling the cleanup cron

`POST /api/cron/cleanup-uploads` requires header `x-cron-secret: <CRON_SECRET>` (the same
`CRON_SECRET` env var the app already requires — see `.env.example`). It is safe to call
repeatedly (idempotent) and caps its own work per invocation, so a frequent schedule (e.g.
hourly) is fine.

### Option A — Vercel Cron

Add to `vercel.json` (not created by this doc — add it yourself, or ask the agent that owns
`vercel.json`/deployment config to wire it in):

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-uploads",
      "schedule": "0 * * * *"
    }
  ]
}
```

Vercel Cron does **not** let you set custom headers on the triggered request, so if you use this
option, also add a `middleware`/route check that accepts Vercel's own cron auth (the
`Authorization: Bearer $CRON_SECRET` header Vercel sends automatically when `CRON_SECRET` is set
as a Vercel env var — see Vercel's Cron Jobs docs) **or** front the route with a thin proxy that
attaches `x-cron-secret` from a server-side secret. The route handler in this repo only checks
`x-cron-secret`; adjust call-site auth to match whichever transport you pick.

### Option B — pg_cron + pg_net (Postgres-native, no external scheduler)

If the Supabase project has `pg_cron` and `pg_net` enabled (Database → Extensions):

```sql
select cron.schedule(
  'cleanup-order-uploads',
  '0 * * * *', -- hourly
  $$
  select net.http_post(
    url := 'https://<your-app-domain>/api/cron/cleanup-uploads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET value>'
    )
  );
  $$
);
```

Store the real `CRON_SECRET` value directly in the SQL only if this project's SQL editor/migration
history is itself access-controlled to the same people who can read `.env` — otherwise prefer
Option A or a secrets-aware scheduler.

## 3. Resend (transactional email)

1. Sign up / log in at [resend.com](https://resend.com).
2. **Domains** → add your sending domain → add the shown DNS records (SPF/DKIM) at your DNS
   provider → wait for verification (usually minutes, can take longer depending on DNS TTL).
3. **API Keys** → create a key scoped to "Sending access" → copy it.
4. Set env vars (see `.env.example`):
   - `RESEND_API_KEY` — the key from step 3.
   - `EMAIL_FROM` — a verified sender on the verified domain, e.g.
     `"Rabea.art <orders@yourdomain.com>"`.
5. Leaving either var unset is supported and intentional for local/preview environments: the app
   detects this (`getOptionalEnv().emailEnabled === false`) and every `sendOrderNotification`
   call short-circuits to a logged `EmailLog` row with `status: "failed"`,
   `error: "EMAIL_DISABLED"` instead of attempting a real send (see
   `src/lib/email/resend.ts`).

No further Resend-side configuration (webhooks, templates, audiences) is required — the app
renders and sends fully-formed HTML itself (`src/lib/email/templates.ts`).
