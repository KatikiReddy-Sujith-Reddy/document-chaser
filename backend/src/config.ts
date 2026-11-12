import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

dotenv.config({ path: path.join(projectRoot, ".env") });

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const defaultedString = (value: string) =>
  z.preprocess((input) => input === "" ? undefined : input, z.string().default(value));
const defaultedNumber = (value: number) =>
  z.preprocess((input) => input === "" ? undefined : input, z.coerce.number().default(value));

const environmentSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: defaultedString("gemini-2.5-flash"),
  DATABASE_URL: defaultedString("file:./data/chaser.db"),
  AS_OF_DATE: defaultedString("2026-11-12").pipe(z.string().regex(datePattern)),
  BASELINE_MEDIAN_DAYS: defaultedNumber(17).pipe(z.number().int().nonnegative()),
  BASELINE_ROUNDS: defaultedNumber(3).pipe(z.number().int().nonnegative()),
  PORT: defaultedNumber(8787).pipe(z.number().int().min(1).max(65535)),
});

export type AppConfig = {
  geminiApiKey: string | undefined;
  geminiModel: string;
  databaseUrl: string;
  asOfDate: string;
  baselineMedianDays: number;
  baselineRounds: number;
  port: number;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);
  const date = new Date(`${parsed.AS_OF_DATE}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== parsed.AS_OF_DATE) {
    throw new Error("AS_OF_DATE must be a valid YYYY-MM-DD date");
  }

  const primaryKey = parsed.GEMINI_API_KEY?.trim();
  const fallbackKey = parsed.GOOGLE_API_KEY?.trim();

  return {
    geminiApiKey: primaryKey || fallbackKey || undefined,
    geminiModel: parsed.GEMINI_MODEL,
    databaseUrl: parsed.DATABASE_URL,
    asOfDate: parsed.AS_OF_DATE,
    baselineMedianDays: parsed.BASELINE_MEDIAN_DAYS,
    baselineRounds: parsed.BASELINE_ROUNDS,
    port: parsed.PORT,
  };
}

export const config = loadConfig();
