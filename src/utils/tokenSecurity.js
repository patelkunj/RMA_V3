import { createHash, randomBytes, timingSafeEqual } from "crypto";

const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");
const generateSecret = (bytes = 32) => randomBytes(bytes).toString("base64url");

const safeEqual = (left, right) => {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const exposeTokensInResponse = () => process.env.NODE_ENV !== "production"
    || process.env.EXPOSE_AUTH_TOKENS_IN_RESPONSE === "true";

export { exposeTokensInResponse, generateSecret, hashToken, safeEqual };
