import fs from "fs";
import net from "net";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const matchesSignature = (file) => {
    const header = fs.readFileSync(file.path).subarray(0, 16);
    const hex = header.toString("hex");
    const ascii = header.toString("ascii");
    switch (file.mimetype) {
        case "image/jpeg": return hex.startsWith("ffd8ff");
        case "image/png": return hex.startsWith("89504e470d0a1a0a");
        case "image/webp": return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
        case "application/pdf": return ascii.startsWith("%PDF-");
        case "application/msword":
        case "application/vnd.ms-excel": return hex.startsWith("d0cf11e0a1b11ae1");
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return hex.startsWith("504b0304");
        default: return false;
    }
};

const scanWithClamAv = (filePath) => new Promise((resolve, reject) => {
    const host = process.env.CLAMAV_HOST;
    if (!host) return resolve({ clean: process.env.FILE_SCAN_REQUIRED !== "true", unavailable: true });
    const socket = net.createConnection({ host, port: Number(process.env.CLAMAV_PORT || 3310) });
    let response = "";
    socket.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS || 15000));
    socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
        stream.on("data", (chunk) => {
            const size = Buffer.alloc(4);
            size.writeUInt32BE(chunk.length);
            socket.write(size);
            socket.write(chunk);
        });
        stream.on("end", () => socket.write(Buffer.alloc(4)));
        stream.on("error", reject);
    });
    socket.on("data", (chunk) => { response += chunk.toString("utf8"); });
    socket.on("end", () => resolve({ clean: response.includes("OK"), response }));
    socket.on("timeout", () => socket.destroy(new Error("File scanner timed out.")));
    socket.on("error", reject);
});

const scanUploads = asyncHandler(async (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    try {
        for (const file of files) {
            if (!matchesSignature(file)) throw new ApiError(415, `File content does not match the declared type for ${file.originalname}.`);
            const result = await scanWithClamAv(file.path);
            if (!result.clean) {
                if (result.unavailable) throw new ApiError(503, "File scanning service is required but unavailable.");
                throw new ApiError(422, `Malware scan rejected ${file.originalname}.`);
            }
        }
        next();
    } catch (error) {
        for (const file of files) {
            if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        throw error;
    }
});

export { matchesSignature, scanUploads, scanWithClamAv };
