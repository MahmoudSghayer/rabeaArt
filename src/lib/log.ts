/**
 * Minimal structured logger.
 *
 * The codebase logs conscientiously — ~47 console.error sites — but as free-text with an error
 * object appended, which means the two things you actually need in an incident are missing:
 * you cannot filter by severity or event, and you cannot correlate a customer's report with a
 * server line. Emitting one JSON object per line fixes both, and is what Vercel's log drains,
 * Datadog and Sentry's log ingestion all expect.
 *
 * Deliberately dependency-free. Wiring an error tracker (Sentry) needs an external DSN and
 * account setup, so that stays a documented manual step — see audit/REMEDIATION-ROADMAP.md.
 * When it lands, `emit()` below is the single place that forwards to it.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Keys whose values are never safe to emit, matched case-insensitively as substrings. */
const REDACT_PATTERNS = [
  // Credentials / secrets.
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "service_role",
  "serviceRole",
  "anonKey",
  // Customer PII. A log sink (Vercel drain, Sentry) is the wrong place for it — correlate an
  // incident to a customer via the order ref/id instead, which are safe to log. Log a recipient
  // email under a key that ends in "email" (e.g. `recipientEmail`) so it is caught here.
  "email",
  "phone",
  "whatsapp",
  "address",
  "street",
  "postal",
  "instructions",
  "notes",
];

const REDACTED = "[redacted]";

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACT_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Recursively redacts sensitive keys and normalizes Errors into a serializable shape.
 * Depth-capped: log context is occasionally handed a Prisma payload or a fetch Response, and an
 * unbounded walk over one of those is both slow and a good way to log something you shouldn't.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // Stacks are for us, not for anyone reading a response body — this never leaves the server.
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shouldRedact(k) ? REDACTED : sanitize(v, depth + 1);
    }
    return out;
  }

  return value;
}

export interface LogContext {
  /** Stable event name, e.g. "order.email.failed" — the thing you alert on. */
  event: string;
  /** Correlates a log line with a request; Vercel supplies one per invocation. */
  requestId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...(sanitize(context) as Record<string, unknown>),
  };

  // One JSON object per line: greppable, and parsed as structured data by every log drain.
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const log = {
  debug: (message: string, context: LogContext) => emit("debug", message, context),
  info: (message: string, context: LogContext) => emit("info", message, context),
  warn: (message: string, context: LogContext) => emit("warn", message, context),
  error: (message: string, context: LogContext) => emit("error", message, context),
};

/** Best-effort per-request correlation id. Vercel sets x-vercel-id on every invocation. */
export function requestIdFrom(headers: Headers): string | undefined {
  return headers.get("x-vercel-id") ?? headers.get("x-request-id") ?? undefined;
}
