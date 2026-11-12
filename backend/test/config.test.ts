import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("configuration", () => {
  it("uses GEMINI_API_KEY first and GOOGLE_API_KEY only as fallback", () => {
    expect(loadConfig({
      GEMINI_API_KEY: "primary-test-key",
      GOOGLE_API_KEY: "fallback-test-key",
    }).geminiApiKey).toBe("primary-test-key");
    expect(loadConfig({
      GEMINI_API_KEY: "",
      GOOGLE_API_KEY: "fallback-test-key",
    }).geminiApiKey).toBe("fallback-test-key");
  });

  it("uses safe defaults for empty optional config values", () => {
    const config = loadConfig({
      GEMINI_API_KEY: "",
      GOOGLE_API_KEY: "",
      GEMINI_MODEL: "",
      DATABASE_URL: "",
      AS_OF_DATE: "",
      BASELINE_MEDIAN_DAYS: "",
      BASELINE_ROUNDS: "",
      PORT: "",
    });

    expect(config).toMatchObject({
      geminiApiKey: undefined,
      geminiModel: "gemini-2.5-flash",
      databaseUrl: "file:./data/chaser.db",
      asOfDate: "2026-11-12",
      baselineMedianDays: 17,
      baselineRounds: 3,
      port: 8787,
    });
  });
});
