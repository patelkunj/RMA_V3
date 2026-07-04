import fs from "fs";
import path from "path";

const LEVELS = {
    silent: 0,
    error: 10,
    warn: 20,
    info: 30,
    debug: 40,
};

const configuredLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info");
const minimumLevel = LEVELS[configuredLevel] ?? LEVELS.info;
const logFormat = process.env.LOG_FORMAT || "json";
const logToFile = process.env.LOG_TO_FILE === "true";
const logFilePath = process.env.LOG_FILE_PATH || "logs/app.log";

const ensureLogFile = () => {
    if (!logToFile) return;

    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
};

const serializeError = (error) => {
    if (!(error instanceof Error)) {
        return error;
    }

    return {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
};

const normalizeMeta = (meta = {}) => {
    if (meta instanceof Error) {
        return { error: serializeError(meta) };
    }

    if (typeof meta !== "object" || meta === null) {
        return { value: meta };
    }

    return Object.fromEntries(
        Object.entries(meta).map(([key, value]) => [
            key,
            value instanceof Error ? serializeError(value) : value,
        ])
    );
};

const writeLog = (entry) => {
    const line = logFormat === "pretty"
        ? `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message} ${JSON.stringify(entry.meta)}`
        : JSON.stringify(entry);

    if (logToFile) {
        ensureLogFile();
        fs.appendFileSync(logFilePath, `${line}\n`);
    }

    if (entry.level === "error") {
        console.error(line);
    } else if (entry.level === "warn") {
        console.warn(line);
    } else {
        console.info(line);
    }
};

const log = (level, message, meta) => {
    if ((LEVELS[level] ?? LEVELS.info) > minimumLevel || minimumLevel === LEVELS.silent) {
        return;
    }

    writeLog({
        timestamp: new Date().toISOString(),
        level,
        message,
        service: process.env.SERVICE_NAME || "rma-backend",
        environment: process.env.NODE_ENV || "development",
        meta: normalizeMeta(meta),
    });
};

const logger = {
    debug(message, meta) {
        log("debug", message, meta);
    },
    info(message, meta) {
        log("info", message, meta);
    },
    warn(message, meta) {
        log("warn", message, meta);
    },
    error(message, meta) {
        log("error", message, meta);
    },
};

export { logger, serializeError };
