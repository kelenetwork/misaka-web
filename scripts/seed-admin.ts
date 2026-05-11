#!/usr/bin/env tsx
/**
 * Seed the initial admin user. Run inside the container:
 *
 *   docker exec misaka-web tsx scripts/seed-admin.ts \
 *     --username kele --email kele@kele.my --password 'STRONG'
 *
 * 如果用户已存在，会升级为 admin 并重置密码。
 */
import { parseArgs } from "node:util";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
    },
    strict: true,
  });

  if (!values.username || !values.email || !values.password) {
    console.error("usage: tsx scripts/seed-admin.ts --username <u> --email <e> --password <p>");
    process.exit(1);
  }
  if (values.password.length < 8) {
    console.error("password must be >= 8 chars");
    process.exit(1);
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, values.username), eq(users.email, values.email)),
  });

  // Get better-auth internal context (where createUser / setPassword lives)
  const ctx = await auth.$context;
  const adapter = ctx.internalAdapter;

  if (existing) {
    console.log(`user exists: ${existing.username} (${existing.email}) → upgrading...`);
    await db.update(users).set({ role: "admin", status: "active", updatedAt: new Date() }).where(eq(users.id, existing.id));
    // Reset password through better-auth so credential hashing matches
    const hashed = await ctx.password.hash(values.password);
    await adapter.updatePassword(existing.id, hashed);
    console.log(`✅ promoted to admin: ${existing.username} <${existing.email}>`);
    return;
  }

  console.log(`creating new admin: ${values.username} <${values.email}>...`);
  const hashed = await ctx.password.hash(values.password);
  const newUser = await adapter.createUser({
    email: values.email,
    name: values.username,
    emailVerified: true,
  });
  const userId = newUser.id;

  // Link credential account (this is how better-auth stores password)
  await adapter.linkAccount({
    userId,
    providerId: "credential",
    accountId: userId,
    password: hashed,
  });

  // Set username + admin
  await db.update(users).set({
    username: values.username,
    role: "admin",
    status: "active",
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  console.log(`✅ admin created: ${values.username} <${values.email}> (id=${userId})`);
}

main().catch((err) => {
  console.error("seed-admin failed:", err);
  process.exit(1);
});
