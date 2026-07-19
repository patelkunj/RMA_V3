import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const encryptionKey = (name, fallbackName) => {
    const secret = process.env[name] || process.env[fallbackName];
    if (!secret) throw new Error(`${name} is required.`);
    return createHash("sha256").update(secret).digest();
};

const encryptValue = (plaintext, keyName, fallbackName) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyName, fallbackName), iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
};

const decryptValue = (ciphertext, keyName, fallbackName) => {
    const [iv, authTag, encrypted] = String(ciphertext).split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(keyName, fallbackName), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

const encryptSecret = (plaintext) => encryptValue(plaintext, "WEBHOOK_ENCRYPTION_KEY", "REFRESH_TOKEN_SECRET");
const decryptSecret = (ciphertext) => decryptValue(ciphertext, "WEBHOOK_ENCRYPTION_KEY", "REFRESH_TOKEN_SECRET");
const encryptDeviceCredential = (plaintext) => encryptValue(plaintext, "DEVICE_DATA_ENCRYPTION_KEY", "REFRESH_TOKEN_SECRET");
const decryptDeviceCredential = (ciphertext) => decryptValue(ciphertext, "DEVICE_DATA_ENCRYPTION_KEY", "REFRESH_TOKEN_SECRET");
const encryptMfaSecret = (plaintext) => encryptValue(plaintext, "MFA_ENCRYPTION_KEY", "REFRESH_TOKEN_SECRET");
const decryptMfaSecret = (ciphertext) => decryptValue(ciphertext, "MFA_ENCRYPTION_KEY", "REFRESH_TOKEN_SECRET");

export { decryptDeviceCredential, decryptMfaSecret, decryptSecret, encryptDeviceCredential, encryptMfaSecret, encryptSecret };
