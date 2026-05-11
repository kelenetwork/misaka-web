import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").unique(),
  // `name` is required by better-auth; we mirror username here.
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  // better-auth core fields
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "banned"] }).notNull().default("active"),
  telegramUserId: text("telegram_user_id").unique(),
  ...timestamps,
});

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull(),
  email: text("email").notNull(),
  reason: text("reason").notNull(),
  ip: text("ip").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  rejectionReason: text("rejection_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const misakaAccounts = sqliteTable("misaka_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  email: text("email").notNull(),
  passwordEncrypted: text("password_encrypted").notNull(),
  sessionCacheEncrypted: text("session_cache_encrypted"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  lastLoginIp: text("last_login_ip"),
  status: text("status", { enum: ["active", "invalid", "rate_limited"] }).notNull().default("active"),
  rateLimitedUntil: integer("rate_limited_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => misakaAccounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  region: text("region").notNull(),
  planId: integer("plan_id").notNull(),
  maxPrice: real("max_price").notNull(),
  targetCount: integer("target_count").notNull(),
  image: text("image").notNull().default("debian-12"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  coupon: text("coupon"),
  sshKeys: text("ssh_keys", { mode: "json" }).$type<string[] | null>(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  currentCount: integer("current_count").notNull().default(0),
  stopAfterTarget: integer("stop_after_target", { mode: "boolean" }).notNull().default(true),
  failureCount: integer("failure_count").notNull().default(0),
  lastFailureAt: integer("last_failure_at", { mode: "timestamp" }),
  nextRetryAt: integer("next_retry_at", { mode: "timestamp" }),
  ...timestamps,
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => users.id),
  accountId: text("account_id").notNull().references(() => misakaAccounts.id),
  region: text("region").notNull(),
  planId: integer("plan_id").notNull(),
  planSlug: text("plan_slug").notNull(),
  regionName: text("region_name").notNull(),
  price: real("price").notNull(),
  misakaOrderId: integer("misaka_order_id").unique(),
  invoiceId: integer("invoice_id"),
  stripeLink: text("stripe_link"),
  status: text("status", { enum: ["pending", "created", "paid", "failed"] }).notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  paidAt: integer("paid_at", { mode: "timestamp" }),
});

export const workerHealth = sqliteTable("worker_health", {
  worker: text("worker").primaryKey(),
  lastTickAt: integer("last_tick_at", { mode: "timestamp" }).notNull(),
  lastSuccessAt: integer("last_success_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const bindCodes = sqliteTable("bind_codes", {
  code: text("code").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const regions = sqliteTable("regions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  facility: text("facility"),
  countryCode: text("country_code").notNull(),
  country: text("country").notNull(),
  continent: text("continent"),
  type: text("type"),
  lat: real("lat"),
  lng: real("lng"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  unavailableReason: text("unavailable_reason"),
  certificates: text("certificates", { mode: "json" }).$type<string[]>(),
  speedtests: text("speedtests", { mode: "json" }).$type<Array<{url: string; label: string}>>(),
  description: text("description"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const inventorySnapshots = sqliteTable("inventory_snapshots", {
  region: text("region").notNull(),
  planId: integer("plan_id").notNull(),
  available: integer("available", { mode: "boolean" }).notNull(),
  planSlug: text("plan_slug").notNull(),
  planName: text("plan_name").notNull(),
  // Pricing (USD)
  priceMonthly: real("price_monthly").notNull(),
  priceSemiannual: real("price_semiannual"),
  priceAnnual: real("price_annual"),
  // Specs
  vcores: integer("vcores").notNull(),
  memoryMb: integer("memory_mb").notNull(),
  diskMb: integer("disk_mb").notNull(),
  transferMb: integer("transfer_mb").notNull(),
  // Network
  networkBillingModel: text("network_billing_model"),
  routingProfile: text("routing_profile"),
  nvme: integer("nvme", { mode: "boolean" }).notNull().default(false),
  // Meta
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  unavailableReason: text("unavailable_reason"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({ pk: primaryKey({ columns: [table.region, table.planId] }) }));

export const systemConfig = sqliteTable("system_config", { key: text("key").primaryKey(), value: text("value").notNull() });

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown> | null>(),
  ip: text("ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const rateLimits = sqliteTable("rate_limits", { key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull() });

export const session = sqliteTable("session", {
  id: text("id").primaryKey(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), token: text("token").notNull().unique(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(), ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});
export const account = sqliteTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }), refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }), scope: text("scope"), password: text("password"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
export const verification = sqliteTable("verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), createdAt: integer("created_at", { mode: "timestamp" }), updatedAt: integer("updated_at", { mode: "timestamp" }) });

export const userRelations = relations(users, ({ many }) => ({ accounts: many(misakaAccounts), tasks: many(tasks), bindCodes: many(bindCodes) }));
export const misakaAccountRelations = relations(misakaAccounts, ({ one, many }) => ({ user: one(users, { fields: [misakaAccounts.userId], references: [users.id] }), tasks: many(tasks) }));
export const taskRelations = relations(tasks, ({ one, many }) => ({ user: one(users, { fields: [tasks.userId], references: [users.id] }), account: one(misakaAccounts, { fields: [tasks.accountId], references: [misakaAccounts.id] }), orders: many(orders) }));
export const bindCodeRelations = relations(bindCodes, ({ one }) => ({ user: one(users, { fields: [bindCodes.userId], references: [users.id] }) }));
