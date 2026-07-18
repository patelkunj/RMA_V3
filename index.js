import dotenv from "dotenv";
import { app } from "./src/app.js";
import prisma from "./src/db/prisma.js";
import { logger } from "./src/utils/logger.js";
import { validateEnvironment } from "./src/config/env.js";
import { startOutboxWorker, stopOutboxWorker } from "./src/services/outbox.service.js";
import { startSlaWorker, stopSlaWorker } from "./src/services/sla.service.js";
import { startMaintenanceWorker, stopMaintenanceWorker } from "./src/services/maintenance.service.js";

dotenv.config({ path: "./.env" });

const start = async () => {
  const config = validateEnvironment();
  await prisma.$connect();

  const server = app.listen(config.port, () => {
    logger.info("server_started", { port: config.port });
  });
  server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 30000);
  server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 15000);
  server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 5000);
  startOutboxWorker();
  startSlaWorker();
  startMaintenanceWorker();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopOutboxWorker();
    stopSlaWorker();
    stopMaintenanceWorker();
    logger.info("server_shutdown_started", { signal });

    const forceExit = setTimeout(() => {
      logger.error("server_shutdown_timed_out", { timeoutMs: config.shutdownTimeoutMs });
      process.exit(1);
    }, config.shutdownTimeoutMs);
    forceExit.unref();

    server.close(async (error) => {
      if (error) logger.error("http_server_close_failed", { error });
      await prisma.$disconnect();
      clearTimeout(forceExit);
      process.exit(error ? 1 : 0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (error) => logger.error("unhandled_rejection", { error }));
  process.on("uncaughtException", (error) => {
    logger.error("uncaught_exception", { error });
    shutdown("uncaughtException");
  });
};

start().catch(async (error) => {
  logger.error("server_start_failed", { error });
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
