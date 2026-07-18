import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { matchesSignature, scanUploads, scanWithClamAv } from "../src/middlewares/uploadSecurity.middleware.js";
import { upload, uploadOrganizationLogo } from "../src/middlewares/multer.middleware.js";

const httpIntegrationEnabled = process.env.RUN_HTTP_INTEGRATION_TESTS === "true";

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => {
    middleware(req, {}, (error) => error ? reject(error) : resolve());
});

test("upload content validation rejects spoofed files and removes staging data", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rma-upload-security-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const spoofedPath = path.join(directory, "spoofed.pdf");
    await fs.writeFile(spoofedPath, Buffer.from("this is not a PDF"));

    const file = { path: spoofedPath, mimetype: "application/pdf", originalname: "spoofed.pdf" };
    assert.equal(matchesSignature(file), false);
    await assert.rejects(
        runMiddleware(scanUploads, { files: [file] }),
        (error) => error.statusCode === 415 && !error.message.includes(spoofedPath),
    );
    await assert.rejects(fs.access(spoofedPath), (error) => error.code === "ENOENT");
});

test("known signatures are accepted and optional scanning fails open only when configured", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rma-upload-signatures-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const fixtures = [
        ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
        ["image/png", Buffer.from("89504e470d0a1a0a", "hex")],
        ["image/webp", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])],
        ["application/pdf", Buffer.from("%PDF-1.7\n")],
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Buffer.from("504b0304", "hex")],
    ];

    for (const [mimetype, contents] of fixtures) {
        const filePath = path.join(directory, mimetype.replaceAll("/", "_").replaceAll(".", "_"));
        await fs.writeFile(filePath, contents);
        assert.equal(matchesSignature({ path: filePath, mimetype }), true, `${mimetype} signature should match`);
    }

    const previousHost = process.env.CLAMAV_HOST;
    const previousRequired = process.env.FILE_SCAN_REQUIRED;
    delete process.env.CLAMAV_HOST;
    process.env.FILE_SCAN_REQUIRED = "false";
    assert.deepEqual(await scanWithClamAv(path.join(directory, "application_pdf")), { clean: true, unavailable: true });
    process.env.FILE_SCAN_REQUIRED = "true";
    assert.deepEqual(await scanWithClamAv(path.join(directory, "application_pdf")), { clean: false, unavailable: true });
    if (previousHost === undefined) delete process.env.CLAMAV_HOST;
    else process.env.CLAMAV_HOST = previousHost;
    if (previousRequired === undefined) delete process.env.FILE_SCAN_REQUIRED;
    else process.env.FILE_SCAN_REQUIRED = previousRequired;
});

test("unsupported declared upload types are always rejected", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rma-upload-unsupported-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "script.js");
    await fs.writeFile(filePath, "console.log('unsafe')");
    assert.equal(matchesSignature({ path: filePath, mimetype: "application/javascript" }), false);
});

test("multipart middleware enforces upload and logo limits over HTTP", {
    skip: httpIntegrationEnabled ? false : "Set RUN_HTTP_INTEGRATION_TESTS=true where loopback listeners are allowed.",
    timeout: 30_000,
}, async (t) => {
    const { default: express } = await import("express");
    const stagingDirectory = path.resolve("public/temp");
    await fs.mkdir(stagingDirectory, { recursive: true });
    const initialFiles = new Set(await fs.readdir(stagingDirectory));
    const cleanupNewFiles = async () => {
        const currentFiles = await fs.readdir(stagingDirectory).catch(() => []);
        await Promise.all(currentFiles
            .filter((name) => !initialFiles.has(name))
            .map((name) => fs.rm(path.join(stagingDirectory, name), { force: true, recursive: true })));
    };
    const assertNoNewFiles = async () => {
        assert.deepEqual(
            (await fs.readdir(stagingDirectory)).sort(),
            [...initialFiles].sort(),
        );
    };
    t.after(cleanupNewFiles);

    const previousHost = process.env.CLAMAV_HOST;
    const previousRequired = process.env.FILE_SCAN_REQUIRED;
    delete process.env.CLAMAV_HOST;
    process.env.FILE_SCAN_REQUIRED = "false";
    t.after(() => {
        if (previousHost === undefined) delete process.env.CLAMAV_HOST;
        else process.env.CLAMAV_HOST = previousHost;
        if (previousRequired === undefined) delete process.env.FILE_SCAN_REQUIRED;
        else process.env.FILE_SCAN_REQUIRED = previousRequired;
    });

    const removeAcceptedFiles = async (req, res) => {
        const files = req.files || (req.file ? [req.file] : []);
        await Promise.all(files.map((file) => fs.rm(file.path, { force: true })));
        res.status(201).json({ files: files.length });
    };
    const app = express();
    app.post("/files", upload.any(), scanUploads, removeAcceptedFiles);
    app.put("/logo", uploadOrganizationLogo, scanUploads, removeAcceptedFiles);
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const statusCode = Number(error?.statusCode) || 500;
        return res.status(statusCode).json({ statusCode, message: error?.message });
    });
    const server = await new Promise((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const send = async (pathname, form, method = "POST") => {
        const response = await fetch(`${baseUrl}${pathname}`, { method, body: form });
        return { status: response.status, body: await response.json() };
    };
    const pdf = () => new Blob([Buffer.from("%PDF-1.7\n")], { type: "application/pdf" });
    const png = (size = 8) => new Blob([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.alloc(Math.max(0, size - 8)),
    ], { type: "image/png" });

    await t.test("accepts a signature-matching file and removes it after handling", async () => {
        const form = new FormData();
        form.append("attachment", pdf(), "document.pdf");
        const response = await send("/files", form);
        assert.deepEqual(response, { status: 201, body: { files: 1 } });
        await cleanupNewFiles();
        await assertNoNewFiles();
    });

    await t.test("rejects spoofed content and unsupported declared MIME types", async () => {
        const spoofed = new FormData();
        spoofed.append("attachment", new Blob(["not-a-pdf"], { type: "application/pdf" }), "spoofed.pdf");
        assert.equal((await send("/files", spoofed)).status, 415);

        const unsupported = new FormData();
        unsupported.append("attachment", new Blob(["script"], { type: "application/javascript" }), "script.js");
        assert.equal((await send("/files", unsupported)).status, 415);
        await cleanupNewFiles();
        await assertNoNewFiles();
    });

    await t.test("rejects too many files and oversized files with safe client errors", async () => {
        const tooMany = new FormData();
        for (let index = 0; index < 11; index += 1) tooMany.append("attachment", pdf(), `${index}.pdf`);
        const countResponse = await send("/files", tooMany);
        assert.equal(countResponse.status, 400);
        assert.match(countResponse.body.message, /at most 10 files/i);

        const oversized = new FormData();
        oversized.append("attachment", new Blob([
            Buffer.from("%PDF-1.7\n"),
            Buffer.alloc((10 * 1024 * 1024) + 1),
        ], { type: "application/pdf" }), "oversized.pdf");
        const sizeResponse = await send("/files", oversized);
        assert.equal(sizeResponse.status, 413);
        assert.match(sizeResponse.body.message, /10 MB/i);
        await cleanupNewFiles();
        await assertNoNewFiles();
    });

    await t.test("enforces logo field, MIME, count, and two-megabyte size contracts", async () => {
        const wrongField = new FormData();
        wrongField.append("attachment", png(), "logo.png");
        assert.equal((await send("/logo", wrongField, "PUT")).status, 400);

        const wrongMime = new FormData();
        wrongMime.append("logo", pdf(), "logo.pdf");
        assert.equal((await send("/logo", wrongMime, "PUT")).status, 415);

        const oversized = new FormData();
        oversized.append("logo", png((2 * 1024 * 1024) + 1), "logo.png");
        assert.equal((await send("/logo", oversized, "PUT")).status, 413);

        const accepted = new FormData();
        accepted.append("logo", png(), "logo.png");
        assert.equal((await send("/logo", accepted, "PUT")).status, 201);
        await cleanupNewFiles();
        await assertNoNewFiles();
    });
});

test("scanner infection and timeout failures remove every staged file", {
    skip: httpIntegrationEnabled ? false : "Set RUN_HTTP_INTEGRATION_TESTS=true where loopback listeners are allowed.",
    timeout: 10_000,
}, async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rma-upload-scanner-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const previousHost = process.env.CLAMAV_HOST;
    const previousPort = process.env.CLAMAV_PORT;
    const previousTimeout = process.env.CLAMAV_TIMEOUT_MS;
    const previousRequired = process.env.FILE_SCAN_REQUIRED;
    process.env.CLAMAV_HOST = "127.0.0.1";
    process.env.FILE_SCAN_REQUIRED = "true";
    t.after(() => {
        for (const [name, value] of [
            ["CLAMAV_HOST", previousHost],
            ["CLAMAV_PORT", previousPort],
            ["CLAMAV_TIMEOUT_MS", previousTimeout],
            ["FILE_SCAN_REQUIRED", previousRequired],
        ]) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });

    const startScanner = async (handler) => {
        const sockets = new Set();
        const scanner = net.createServer((socket) => {
            sockets.add(socket);
            socket.once("close", () => sockets.delete(socket));
            handler(socket);
        });
        await new Promise((resolve) => scanner.listen(0, "127.0.0.1", resolve));
        const stop = async () => {
            for (const socket of sockets) socket.destroy();
            if (scanner.listening) await new Promise((resolve) => scanner.close(resolve));
        };
        t.after(stop);
        process.env.CLAMAV_PORT = String(scanner.address().port);
        return { scanner, stop };
    };

    await t.test("infected responses produce 422 and delete the upload", async () => {
        const { stop } = await startScanner((socket) => {
            let request = Buffer.alloc(0);
            socket.on("data", (chunk) => {
                request = Buffer.concat([request, chunk]);
                if (request.subarray(-4).equals(Buffer.alloc(4))) {
                    socket.end("stream: Eicar-Test-Signature FOUND\0");
                }
            });
        });
        const filePath = path.join(directory, "infected.pdf");
        await fs.writeFile(filePath, "%PDF-1.7\nEICAR");
        await assert.rejects(
            runMiddleware(scanUploads, { files: [{ path: filePath, mimetype: "application/pdf", originalname: "infected.pdf" }] }),
            (error) => error.statusCode === 422,
        );
        await assert.rejects(fs.access(filePath), (error) => error.code === "ENOENT");
        await stop();
    });

    await t.test("scanner timeouts reject and delete the upload", async () => {
        const { stop } = await startScanner(() => undefined);
        process.env.CLAMAV_TIMEOUT_MS = "50";
        const filePath = path.join(directory, "timeout.pdf");
        await fs.writeFile(filePath, "%PDF-1.7\ntimeout");
        await assert.rejects(
            runMiddleware(scanUploads, { files: [{ path: filePath, mimetype: "application/pdf", originalname: "timeout.pdf" }] }),
            /timed out/i,
        );
        await assert.rejects(fs.access(filePath), (error) => error.code === "ENOENT");
        await stop();
    });

    await t.test("scanner connection errors reject and delete the upload", async () => {
        const reservation = net.createServer();
        await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
        const unavailablePort = reservation.address().port;
        await new Promise((resolve) => reservation.close(resolve));
        process.env.CLAMAV_PORT = String(unavailablePort);
        process.env.CLAMAV_TIMEOUT_MS = "250";

        const filePath = path.join(directory, "connection-error.pdf");
        await fs.writeFile(filePath, "%PDF-1.7\nconnection-error");
        await assert.rejects(
            runMiddleware(scanUploads, { files: [{ path: filePath, mimetype: "application/pdf", originalname: "connection-error.pdf" }] }),
        );
        await assert.rejects(fs.access(filePath), (error) => error.code === "ENOENT");
    });
});
