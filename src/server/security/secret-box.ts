import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM for third-party credentials we must be able to read back
// (e.g. a clinic's NetGSM password) — unlike user passwords, these can't be
// hashed. Key: SECRETS_ENCRYPTION_KEY (any long random string) or, if unset,
// derived from AUTH_SECRET. Changing the key makes stored secrets
// unreadable; clinics would then need to re-enter them.
function key() {
  const source = process.env.SECRETS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!source) throw new Error("SECRETS_ENCRYPTION_KEY veya AUTH_SECRET tanımlı olmalı.");
  return createHash("sha256").update(`secret-box:${source}`).digest();
}

/** Returns "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Geçersiz şifreli veri.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
