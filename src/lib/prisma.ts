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
  const adapter = new PrismaPg({ connectionString });
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
