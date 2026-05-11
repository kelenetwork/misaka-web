import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "node:crypto";

function getKey(): Uint8Array {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) throw new Error("ENCRYPTION_KEY must be 64 hex characters");
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = gcm(getKey(), iv);
  const ciphertextWithTag = cipher.encrypt(Buffer.from(plaintext, "utf8"));
  return Buffer.concat([iv, Buffer.from(ciphertextWithTag)]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const payload = Buffer.from(ciphertext, "base64");
  if (payload.length < 29) throw new Error("Invalid ciphertext");
  const iv = payload.subarray(0, 12);
  const encrypted = payload.subarray(12);
  const cipher = gcm(getKey(), iv);
  return Buffer.from(cipher.decrypt(encrypted)).toString("utf8");
}
