import { config } from "./config.js";
import { db } from "./db/client.js";
import { createDraftService } from "./services/draftService.js";
import { createApp } from "./app.js";

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

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Document Chaser API listening on 127.0.0.1:${config.port}`);
});
