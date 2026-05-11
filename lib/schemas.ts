import { z } from "zod";

export const createTaskSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  planId: z.coerce.number().int(),
  maxPrice: z.coerce.number(),
  targetCount: z.coerce.number().int().positive(),
  image: z.string().min(1).optional(),
  billingCycle: z.string().min(1).optional(),
  coupon: z.string().nullable().optional(),
  sshKeys: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
  stopAfterTarget: z.boolean().optional(),
}).strict();

export const patchTaskSchema = z.object({
  accountId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  planId: z.coerce.number().int().optional(),
  maxPrice: z.coerce.number().optional(),
  targetCount: z.coerce.number().int().positive().optional(),
  image: z.string().min(1).optional(),
  billingCycle: z.string().min(1).optional(),
  coupon: z.string().nullable().optional(),
  sshKeys: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
  stopAfterTarget: z.boolean().optional(),
}).strict();

export const createAccountSchema = z.object({
  label: z.string().min(1),
  email: z.email(),
  password: z.string().min(1),
}).strict();

export const patchAccountSchema = z.object({
  label: z.string().min(1).optional(),
  email: z.email().optional(),
  password: z.string().min(1).optional(),
}).strict();

export const patchAdminUserSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "banned"]).optional(),
  username: z.string().min(1).optional(),
}).strict();

export const patchSystemConfigSchema = z.object({
  key: z.enum(["pollIntervalSec", "circuitBreakerMinutes", "applyRateLimitPerHour", "applyRateLimitPer5Min"]),
  value: z.unknown(),
}).strict();
