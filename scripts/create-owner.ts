// One-off CLI to provision the first OWNER admin account. Not part of the app's request
// lifecycle — run manually once real Supabase credentials exist:
//   npx tsx scripts/create-owner.ts --email owner@rabea.art --name "Rabea" [--password ...]
//
// Creates (or reuses) a Supabase auth.users row via the service-role admin API, then upserts
// the matching prisma AdminUser row with role OWNER. Cannot run against the placeholder
// credentials currently in .env — compiling cleanly is the bar until real credentials arrive.
import "dotenv/config";
import crypto from "node:crypto";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AdminRole } from "@/generated/prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

const argsSchema = z.object({
  email: z.email("A valid --email is required"),
  name: z.string().min(1, "--name is required"),
  password: z.string().min(8, "--password must be at least 8 characters").optional(),
});

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

type Flags = { email?: string; name?: string; password?: string };

/** Minimal `--flag value` / `--flag=value` parser — no need for a CLI-args dependency for three flags. */
function parseFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eqIndex = arg.indexOf("=");
    let key: string;
    let value: string | undefined;
    if (eqIndex !== -1) {
      key = arg.slice(2, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else {
      key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        i++;
      }
    }
    if (key === "email" || key === "name" || key === "password") {
      flags[key] = value;
    }
  }
  return flags;
}

/** Random, URL-safe password used only when `--password` is omitted; printed once, never logged again. */
function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

/**
 * `createUser` fails with an "already exists" error on rerun — GoTrue has no
 * get-user-by-email endpoint, so reusing an existing account means paging through
 * `listUsers()` to find the match. Capped well above any realistic admin headcount for this
 * store; if it's ever exceeded, the dashboard is the right place to look instead.
 */
async function findAuthUserByEmail(supabase: SupabaseAdminClient, email: string) {
  const perPage = 200;
  const maxPages = 10;
  const target = email.toLowerCase();
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function main(): Promise<void> {
  const args = argsSchema.safeParse(parseFlags(process.argv.slice(2)));
  if (!args.success) {
    console.error("Invalid arguments:");
    for (const issue of args.error.issues) console.error(`  - ${issue.message}`);
    console.error('\nUsage: npx tsx scripts/create-owner.ts --email owner@rabea.art --name "Rabea" [--password ...]');
    process.exitCode = 1;
    return;
  }

  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error("Missing or invalid environment variables:");
    for (const issue of env.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DIRECT_URL (or DATABASE_URL) is not set — copy .env.example to .env and fill it in.");
    process.exitCode = 1;
    return;
  }

  const { email, name } = args.data;
  const passwordProvided = args.data.password !== undefined;
  const password = args.data.password ?? generatePassword();

  const supabase = createSupabaseAdminClient();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    let authUserId: string;
    if (created.error) {
      const alreadyExists =
        created.error.code === "email_exists" ||
        created.error.code === "user_already_exists" ||
        /already.*registered|already.*exists/i.test(created.error.message);
      if (!alreadyExists) {
        console.error("Failed to create Supabase auth user:", created.error.message);
        process.exitCode = 1;
        return;
      }
      console.log(`Auth user for ${email} already exists — reusing it.`);
      const existing = await findAuthUserByEmail(supabase, email);
      if (!existing) {
        console.error(
          `Supabase reported ${email} already exists, but it could not be found via listUsers(). Check the Supabase dashboard manually.`,
        );
        process.exitCode = 1;
        return;
      }
      authUserId = existing.id;
    } else {
      authUserId = created.data.user.id;
    }

    const admin = await prisma.adminUser.upsert({
      where: { id: authUserId },
      update: { email, name, role: AdminRole.OWNER, active: true },
      create: { id: authUserId, email, name, role: AdminRole.OWNER, active: true },
    });

    console.log("\nOwner account ready:");
    console.log(`  id:    ${admin.id}`);
    console.log(`  email: ${admin.email}`);
    console.log(`  name:  ${admin.name}`);
    console.log(`  role:  ${admin.role}`);
    if (!passwordProvided) {
      console.log(`\n  Generated password (shown once — store it now): ${password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("create-owner failed:", err);
  process.exitCode = 1;
});
