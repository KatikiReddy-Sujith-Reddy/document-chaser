import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "../config.js";

export type SeedRecord = Record<string, unknown> & { isSynthetic: true };

export type SeedCaseFile = {
  isSynthetic: true;
  client: SeedRecord;
  case: SeedRecord;
  requirements: SeedRecord[];
  documents: SeedRecord[];
  events: SeedRecord[];
};

function assertSyntheticRecord(value: unknown, source: string): asserts value is SeedRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid synthetic seed record in ${source}`);
  }
  if ((value as Record<string, unknown>).isSynthetic !== true) {
    throw new Error(`Seed record in ${source} is missing isSynthetic: true`);
  }
}

export function parseSeedCase(content: string, source: string): SeedCaseFile {
  const value: unknown = JSON.parse(content);
  assertSyntheticRecord(value, source);
  const seed = value as SeedCaseFile;
  for (const key of ["client", "case"] as const) assertSyntheticRecord(seed[key], source);
  for (const key of ["requirements", "documents", "events"] as const) {
    if (!Array.isArray(seed[key])) throw new Error(`Invalid ${key} list in ${source}`);
    for (const record of seed[key]) assertSyntheticRecord(record, source);
  }
  return seed;
}

export function loadSeedCases(seedDirectory = path.join(projectRoot, "data", "seed")): SeedCaseFile[] {
  const files = fs.readdirSync(seedDirectory)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return files.map((name) => {
    const filePath = path.join(seedDirectory, name);
    return parseSeedCase(fs.readFileSync(filePath, "utf8"), name);
  });
}
