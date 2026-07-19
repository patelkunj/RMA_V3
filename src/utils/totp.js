import { createHmac, randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (buffer) => {
    let bits = "";
    for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
    let output = "";
    for (let index = 0; index < bits.length; index += 5) output += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
    return output;
};

const base32Decode = (value) => {
    let bits = "";
    for (const character of String(value).replaceAll("=", "").toUpperCase()) {
        const index = ALPHABET.indexOf(character);
        if (index < 0) throw new Error("Invalid base32 value.");
        bits += index.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
    return Buffer.from(bytes);
};

const createTotpSecret = () => base32Encode(randomBytes(20));

const totpAt = (secret, timestamp = Date.now(), stepSeconds = 30) => {
    const counter = Math.floor(timestamp / 1000 / stepSeconds);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return String(number).padStart(6, "0");
};

const verifyTotp = (secret, code, timestamp = Date.now()) => {
    const normalized = String(code || "").trim();
    if (!/^\d{6}$/.test(normalized)) return false;
    return [-1, 0, 1].some((window) => totpAt(secret, timestamp + window * 30000) === normalized);
};

export { createTotpSecret, totpAt, verifyTotp };
