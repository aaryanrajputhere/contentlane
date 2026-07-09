import "dotenv/config";
import { createApp } from "./app";
import { config } from "./config";
import prisma from "./lib/prisma";
import { logger } from "./lib/logger";

const app = createApp();
const server = app.listen(config.PORT, () =>
  logger.info({ port: config.PORT }, "ContentLane API started"),
);

async function shutdown(signal: string) {
  logger.info({ signal }, "API shutting down");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
