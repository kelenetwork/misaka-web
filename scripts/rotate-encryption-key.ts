/**
 * ENCRYPTION_KEY 轮换脚本
 *
 * 用法：
 *   docker compose stop misaka-web                       # 停服防并发写
 *   docker compose run --rm \
 *     -e OLD_ENCRYPTION_KEY="<旧 64 hex key>" \
 *     -e NEW_ENCRYPTION_KEY="<新 64 hex key>" \
 *     misaka-web \
 *     node_modules/.bin/tsx scripts/rotate-encryption-key.ts
 *   # 备份成功后把 .env 里的 ENCRYPTION_KEY 改为 NEW_ENCRYPTION_KEY
 *   docker compose up -d misaka-web
 *
 * 生成新 key：
 *   openssl rand -hex 32
 */
import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, sqlite } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getKey(hex: string | undefined, label: string): Uint8Array {
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${label} must be 64 hex characters`);
  }
  return Buffer.from(hex, "hex");
}

function encryptWith(plaintext: string, key: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ct = cipher.encrypt(Buffer.from(plaintext, "utf8"));
  return Buffer.concat([iv, Buffer.from(ct)]).toString("base64");
}

function decryptWith(ciphertext: string, key: Uint8Array): string {
  const payload = Buffer.from(ciphertext, "base64");
  if (payload.length < 29) throw new Error("Invalid ciphertext");
  const iv = payload.subarray(0, 12);
  const ct = payload.subarray(12);
  const cipher = gcm(key, iv);
  return Buffer.from(cipher.decrypt(ct)).toString("utf8");
}

async function main() {
  const oldKey = getKey(process.env.OLD_ENCRYPTION_KEY, "OLD_ENCRYPTION_KEY");
  const newKey = getKey(process.env.NEW_ENCRYPTION_KEY, "NEW_ENCRYPTION_KEY");

  if (Buffer.compare(oldKey, newKey) === 0) {
    throw new Error("OLD and NEW key are the same, nothing to rotate");
  }

  // 备份 sqlite 文件
  const dbPath = (process.env.DATABASE_URL ?? "file:./data/misaka.db").replace(/^file:/, "");
  if (dbPath !== ":memory:") {
    const backup = `${dbPath}.bak-rotate-${Date.now()}`;
    fs.copyFileSync(dbPath, backup);
    console.log(`✓ DB 已备份到 ${backup}`);
  }

  const accounts = await db.select().from(misakaAccounts);
  console.log(`即将轮换 ${accounts.length} 个 misaka_accounts 加密字段...`);

  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  sqlite.transaction(() => {
    for (const account of accounts) {
      const updates: Record<string, string | null> = {};
      try {
        const pwPlain = decryptWith(account.passwordEncrypted, oldKey);
        updates.passwordEncrypted = encryptWith(pwPlain, newKey);
      } catch (err) {
        console.error(`✗ ${account.id} password decrypt 失败:`, err instanceof Error ? err.message : err);
        failed += 1;
        continue;
      }
      if (account.sessionCacheEncrypted) {
        try {
          const sess = decryptWith(account.sessionCacheEncrypted, oldKey);
          updates.sessionCacheEncrypted = encryptWith(sess, newKey);
        } catch (err) {
          // session cache 损坏不致命，清空就好
          console.warn(`! ${account.id} session_cache decrypt 失败，清空 (${err instanceof Error ? err.message : err})`);
          updates.sessionCacheEncrypted = null;
        }
      }
      db.update(misakaAccounts)
        .set(updates as any)
        .where(eq(misakaAccounts.id, account.id))
        .run();
      rotated += 1;
    }
  })();

  console.log(`\n=== 完成 ===`);
  console.log(`成功轮换: ${rotated}`);
  console.log(`失败:       ${failed}`);
  console.log(`跳过:       ${skipped}`);
  if (failed > 0) {
    console.error(`\n⚠ 有 ${failed} 个账号轮换失败，请人工排查后恢复备份。`);
    process.exit(2);
  }
  console.log(`\n下一步：把 .env 里 ENCRYPTION_KEY 改为新 key 后重启 misaka-web。`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
