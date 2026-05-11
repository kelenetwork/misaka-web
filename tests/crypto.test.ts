import { describe, expect, it } from "vitest";
process.env.ENCRYPTION_KEY = "a".repeat(64);
const { encrypt, decrypt } = await import("../lib/crypto");
describe("crypto", () => { it("round-trips AES-GCM ciphertext", () => { const encrypted = encrypt("hello misaka"); expect(encrypted).not.toBe("hello misaka"); expect(decrypt(encrypted)).toBe("hello misaka"); }); });
