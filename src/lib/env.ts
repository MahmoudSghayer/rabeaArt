import { z } from "zod";

/**
 * Infra-critical vars hard-fail app startup (see src/instrumentation.ts) — a misconfigured
 * database/auth connection must never fail silently. RESEND_API_KEY is intentionally optional:
 * missing it only disables outbound email (see lib/email), it never blocks the app.
 */
const requiredSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (pooled Supabase connection)"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required (direct Supabase connection, for migrations)"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
});

const optionalSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type RequiredEnv = z.infer<typeof requiredSchema>;
export type OptionalEnv = z.infer<typeof optionalSchema>;

let cachedRequired: RequiredEnv | null = null;

/** Throws a clear, aggregated error if any infra-critical env var is missing/invalid. */
export function assertRequiredEnv(): RequiredEnv {
  if (cachedRequired) return cachedRequired;
  const parsed = requiredSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      [
        "Missing or invalid required environment variables.",
        "Copy .env.example to .env and fill in your Supabase project credentials:",
        ...lines,
      ].join("\n"),
    );
  }
  cachedRequired = parsed.data;
  return cachedRequired;
}

/** Never throws — callers must handle `emailEnabled === false` gracefully. */
export function getOptionalEnv(): OptionalEnv & { emailEnabled: boolean } {
  const parsed = optionalSchema.safeParse(process.env);
  const data = parsed.success ? parsed.data : {};
  return {
    ...data,
    emailEnabled: Boolean(data.RESEND_API_KEY && data.EMAIL_FROM),
  };
}
