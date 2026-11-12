import { and, eq, inArray } from "drizzle-orm";
import { db, sqlite } from "./client.js";
import { cases, clients, documents, drafts, events, requirements, requirementTypes, tasks } from "./schema.js";
import { loadSeedCases } from "./seedLoader.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { projectRoot } from "../config.js";

const requirementTypeRows = [
  ["INC", "Certificate of incorporation", "Required for all corporate clients.", null],
  ["DIR", "Register of directors", "Must be dated within the last 90 days.", 90],
  ["ADDR", "Proof of business address", "Confirms the registered business address.", null],
  ["OWN", "Beneficial ownership register", "Required to document ownership and control.", null],
  ["TAX", "Tax registration certificate", "Required for the corporate tax profile.", null],
  ["BANK", "Recent bank statement", "Confirms the business account details.", null],
  ["ART", "Articles of association", "Required to confirm the company's governing rules.", null],
  ["ID", "Director identity document", "Required for an authorized company director.", null],
  ["RES", "Board resolution", "Required to document authority for the onboarding request.", null],
  ["FIN", "Financial statements", "Required to complete the business profile.", null],
].map(([code, label, reasonText, maxAgeDays]) => ({
  code: code as string,
  label: label as string,
  appliesTo: "corporate" as const,
  reasonText: reasonText as string,
  maxAgeDays: maxAgeDays as number | null,
  isSynthetic: true,
}));

export async function seedDatabase(targetDb: typeof db = db, applyMigrations = true): Promise<void> {
  if (applyMigrations) {
    migrate(targetDb, { migrationsFolder: path.join(projectRoot, "backend", "src", "db", "migrations") });
  }
  const seedFiles = loadSeedCases();
  const seededCaseIds = seedFiles.map((seed) => (seed.case as typeof cases.$inferInsert).id);
  const seededClientIds = seedFiles.map((seed) => (seed.client as typeof clients.$inferInsert).id);

  targetDb.transaction((transaction) => {
    transaction.delete(tasks).where(and(eq(tasks.isSynthetic, true), inArray(tasks.caseId, seededCaseIds))).run();
    transaction.delete(drafts).where(and(eq(drafts.isSynthetic, true), inArray(drafts.caseId, seededCaseIds))).run();
    transaction.delete(events).where(and(eq(events.isSynthetic, true), inArray(events.caseId, seededCaseIds))).run();
    transaction.delete(documents).where(and(eq(documents.isSynthetic, true), inArray(documents.caseId, seededCaseIds))).run();
    transaction.delete(requirements).where(and(eq(requirements.isSynthetic, true), inArray(requirements.caseId, seededCaseIds))).run();
    transaction.delete(cases).where(and(eq(cases.isSynthetic, true), inArray(cases.id, seededCaseIds))).run();
    transaction.delete(clients).where(and(eq(clients.isSynthetic, true), inArray(clients.id, seededClientIds))).run();

    for (const { code, label, appliesTo, reasonText, maxAgeDays } of requirementTypeRows) {
      const existing = transaction.select().from(requirementTypes)
        .where(eq(requirementTypes.code, code)).get();
      if (existing) {
        transaction.update(requirementTypes).set({
          label,
          appliesTo,
          reasonText,
          maxAgeDays,
          isSynthetic: true,
        }).where(eq(requirementTypes.code, code)).run();
      } else {
        transaction.insert(requirementTypes).values({
          code,
          label,
          appliesTo,
          reasonText,
          maxAgeDays,
          isSynthetic: true,
        }).run();
      }
    }

    for (const seed of seedFiles) {
      const client = seed.client as typeof clients.$inferInsert;
      const caseRecord = seed.case as typeof cases.$inferInsert;
      transaction.insert(clients).values(client).run();
      transaction.insert(cases).values(caseRecord).run();

      for (const record of seed.requirements as (typeof requirements.$inferInsert)[]) {
        transaction.insert(requirements).values(record).run();
      }
      for (const record of seed.documents as (typeof documents.$inferInsert)[]) {
        transaction.insert(documents).values(record).run();
      }
      for (const record of seed.events as (typeof events.$inferInsert)[]) {
        transaction.insert(events).values(record).run();
      }
    }
  });

  console.log(`Loaded ${seedFiles.length} synthetic cases.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await seedDatabase();
  } finally {
    sqlite.close();
  }
}
