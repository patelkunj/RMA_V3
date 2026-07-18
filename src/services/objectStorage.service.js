import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

const OBJECT_REFERENCE_PREFIX = "object://";
const LOCAL_PRIVATE_ROOT = path.resolve(process.env.LOCAL_PRIVATE_UPLOAD_ROOT || "var/private-uploads");

let s3Client;

const getProvider = () => String(process.env.UPLOAD_STORAGE_PROVIDER || "local").trim().toLowerCase();

const normalizeObjectKey = (value) => {
    const key = String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
    if (!key || key.includes("..") || key.split("/").some((part) => !part || part === ".")) {
        throw new ApiError(500, "Stored file reference is invalid.");
    }
    return key;
};

const objectReference = (key) => `${OBJECT_REFERENCE_PREFIX}${normalizeObjectKey(key)}`;
const keyFromReference = (reference) => {
    if (!String(reference || "").startsWith(OBJECT_REFERENCE_PREFIX)) return null;
    return normalizeObjectKey(String(reference).slice(OBJECT_REFERENCE_PREFIX.length));
};

const localPathForKey = (key) => {
    const candidate = path.resolve(LOCAL_PRIVATE_ROOT, normalizeObjectKey(key));
    const relative = path.relative(LOCAL_PRIVATE_ROOT, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new ApiError(500, "Stored file path is invalid.");
    return candidate;
};

const getS3Client = () => {
    if (s3Client) return s3Client;
    const endpoint = String(process.env.OBJECT_STORAGE_ENDPOINT || "").trim() || undefined;
    const accessKeyId = String(process.env.OBJECT_STORAGE_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = String(process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || "").trim();
    s3Client = new S3Client({
        region: process.env.OBJECT_STORAGE_REGION,
        endpoint,
        forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true",
        ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
    return s3Client;
};

const getBucket = () => {
    const bucket = String(process.env.OBJECT_STORAGE_BUCKET || "").trim();
    if (!bucket) throw new ApiError(500, "Object storage bucket is not configured.");
    return bucket;
};

const hashFile = async (filePath) => new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
});

const putPrivateObject = async ({ key, filePath, contentType }) => {
    const normalizedKey = normalizeObjectKey(key);
    const [stat, hash] = await Promise.all([fs.promises.stat(filePath), hashFile(filePath)]);
    const provider = getProvider();

    if (provider === "s3") {
        const kmsKeyId = String(process.env.OBJECT_STORAGE_KMS_KEY_ID || "").trim();
        await getS3Client().send(new PutObjectCommand({
            Bucket: getBucket(),
            Key: normalizedKey,
            Body: fs.createReadStream(filePath),
            ContentLength: stat.size,
            ContentType: contentType || "application/octet-stream",
            Metadata: { sha256: hash },
            ServerSideEncryption: kmsKeyId ? "aws:kms" : "AES256",
            ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}),
        }));
        await fs.promises.unlink(filePath).catch(() => {});
    } else if (provider === "local") {
        const destination = localPathForKey(normalizedKey);
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.rename(filePath, destination);
    } else {
        throw new ApiError(500, "UPLOAD_STORAGE_PROVIDER must be local or s3.");
    }

    return { key: normalizedKey, reference: objectReference(normalizedKey), hash, size: stat.size };
};

const streamToBuffer = async (body) => {
    if (!body) return Buffer.alloc(0);
    if (typeof body.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
};

const getPrivateObject = async (key) => {
    const normalizedKey = normalizeObjectKey(key);
    try {
        if (getProvider() === "s3") {
            const response = await getS3Client().send(new GetObjectCommand({ Bucket: getBucket(), Key: normalizedKey }));
            const buffer = await streamToBuffer(response.Body);
            return {
                buffer,
                contentType: response.ContentType || "application/octet-stream",
                size: response.ContentLength ?? buffer.length,
                hash: response.Metadata?.sha256 || createHash("sha256").update(buffer).digest("hex"),
                updatedAt: response.LastModified || null,
            };
        }
        if (getProvider() !== "local") throw new ApiError(500, "UPLOAD_STORAGE_PROVIDER must be local or s3.");
        const filePath = localPathForKey(normalizedKey);
        const [buffer, stat] = await Promise.all([fs.promises.readFile(filePath), fs.promises.stat(filePath)]);
        return {
            buffer,
            contentType: "application/octet-stream",
            size: stat.size,
            hash: createHash("sha256").update(buffer).digest("hex"),
            updatedAt: stat.mtime,
        };
    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error?.name === "NoSuchKey" || error?.code === "ENOENT" || error?.$metadata?.httpStatusCode === 404) {
            throw new ApiError(404, "Stored file not found.");
        }
        logger.error("private_object_read_failed", { key: normalizedKey, error });
        throw new ApiError(503, "Stored file is temporarily unavailable.");
    }
};

const deletePrivateObject = async (key) => {
    const normalizedKey = normalizeObjectKey(key);
    try {
        if (getProvider() === "s3") {
            await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: normalizedKey }));
        } else if (getProvider() === "local") {
            await fs.promises.unlink(localPathForKey(normalizedKey)).catch((error) => {
                if (error.code !== "ENOENT") throw error;
            });
        } else {
            throw new ApiError(500, "UPLOAD_STORAGE_PROVIDER must be local or s3.");
        }
    } catch (error) {
        logger.warn("private_object_delete_failed", { key: normalizedKey, error });
        throw error;
    }
};

const resetObjectStorageClientForTests = () => { s3Client = undefined; };

export {
    deletePrivateObject,
    getPrivateObject,
    keyFromReference,
    normalizeObjectKey,
    objectReference,
    putPrivateObject,
    resetObjectStorageClientForTests,
};
