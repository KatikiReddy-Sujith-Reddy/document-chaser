import { config } from "./config.js";
import { db } from "./db/client.js";
import { createDraftService } from "./services/draftService.js";
import { createApp } from "./app.js";
import { seedDatabase } from "./db/seed.js";

// Initialize database with migrations and default seed cases if starting fresh
try {
  await seedDatabase(db, true);
} catch (error) {
  console.warn("[db] Automatic seed check warning:", error);
}

const app = createApp({
  database: db,
  generateDraft: createDraftService({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  }),
  runtime: {
    asOfDate: config.asOfDate,
    baselineMedianDays: config.baselineMedianDays,
    baselineRounds: config.baselineRounds,
  },
});

const host = process.env.HOST ?? "0.0.0.0";
app.listen(config.port, host, () => {
  console.log(`Document Chaser listening on ${host}:${config.port}`);
});
