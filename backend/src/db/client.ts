import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config, projectRoot } from "../config.js";
import { schema } from "./schema.js";

export function resolveDatabasePath(databaseUrl: string): string {
  if (databaseUrl === ":memory:") return databaseUrl;
  const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  return path.resolve(projectRoot, filePath);
}

const databasePath = resolveDatabasePath(config.databaseUrl);
if (databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

export const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });
