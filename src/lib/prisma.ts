import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7's TS client generator has no built-in query-engine binary — it requires an explicit
 * driver adapter. We point it at DATABASE_URL (the pooled/pgbouncer Supabase connection) so the
 * app is serverless-safe; migrations use DIRECT_URL instead (see prisma.config.ts).
 *
 * The client is constructed LAZILY (first property access), not at module load: `next build`
 * imports route modules while collecting page data, and that must succeed on CI/Vercel where no
 * DATABASE_URL exists. Requests fail loudly at runtime instead if the env is missing.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env and fill it in.");
  }
  // DB-07: DATABASE_URL must be the POOLED Supabase connection (Supavisor — port 6543 /
  // ?pgbouncer=true). A direct :5432 URL opens a full Postgres connection per pool slot and
  // exhausts the direct-connection limit within a few concurrent lambdas. Warn rather than throw:
  // the site is live, and a noisy log beats a boot failure if the URL format is merely unusual.
  if (!/6543|pgbouncer=true/.test(connectionString)) {
    console.warn(
      "prisma: DATABASE_URL does not look like the pooled Supabase connection (:6543 / pgbouncer=true) — connection-exhaustion risk under load (audit DB-07).",
    );
  }
  // DB-07: cap connections PER serverless instance. Vercel autoscales instances, so the real
  // ceiling is (instances x max) against Supavisor — an unbounded per-instance pool (pg-pool's
  // default of 10) lets a modest burst converge past that ceiling. 3 is ample at this scale.
  const adapter = new PrismaPg({ connectionString, max: 3 });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (globalThis.__prisma) return globalThis.__prisma;
  const client = createClient();
  // Cache across dev HMR reloads AND across route modules in production — the client is
  // stateless config + a connection pool, and one pool per server instance is the goal.
  globalThis.__prisma = client;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver === undefined ? client : client);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
