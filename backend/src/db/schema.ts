import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const synthetic = () => integer("is_synthetic", { mode: "boolean" }).notNull().default(true);

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientType: text("client_type", { enum: ["corporate", "individual"] }).notNull(),
  isSynthetic: synthetic(),
});

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id),
  rmName: text("rm_name").notNull(),
  openedOn: text("opened_on").notNull(),
  approvedOn: text("approved_on"),
  status: text("status", {
    enum: ["open", "awaiting_client", "ready_for_review", "complete", "parked"],
  }).notNull(),
  isSynthetic: synthetic(),
});

export const requirementTypes = sqliteTable("requirement_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  appliesTo: text("applies_to", { enum: ["corporate", "individual"] }).notNull(),
  reasonText: text("reason_text").notNull(),
  maxAgeDays: integer("max_age_days"),
  isSynthetic: synthetic(),
});

export const requirements = sqliteTable(
  "requirements",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull().references(() => cases.id),
    requirementCode: text("requirement_code").notNull().references(() => requirementTypes.code),
    requestedOn: text("requested_on"),
    receivedOn: text("received_on"),
    status: text("status", { enum: ["missing", "needs_resubmission", "received"] }).notNull(),
    isSynthetic: synthetic(),
  },
  (table) => [uniqueIndex("requirements_case_code_idx").on(table.caseId, table.requirementCode)],
);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  requirementCode: text("requirement_code").notNull().references(() => requirementTypes.code),
  issuedOn: text("issued_on"),
  expiresOn: text("expires_on"),
  legible: integer("legible", { mode: "boolean" }).notNull(),
  submittedOn: text("submitted_on").notNull(),
  isSynthetic: synthetic(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  type: text("type", {
    enum: [
      "requested",
      "approved",
      "client_reply",
      "received",
      "reminder_created",
      "call_created",
      "held",
      "parked",
    ],
  }).notNull(),
  occurredOn: text("occurred_on").notNull(),
  payload: text("payload").notNull().default("{}"),
  isSynthetic: synthetic(),
});

export const drafts = sqliteTable("drafts", {
  caseId: text("case_id").primaryKey().references(() => cases.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  source: text("source", { enum: ["gemini", "template"] }).notNull(),
  edited: integer("edited", { mode: "boolean" }).notNull().default(false),
  updatedOn: text("updated_on").notNull(),
  isSynthetic: synthetic(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => cases.id),
  type: text("type", { enum: ["reminder", "call"] }).notNull(),
  dueOn: text("due_on").notNull(),
  doneOn: text("done_on"),
  cancelledOn: text("cancelled_on"),
  isSynthetic: synthetic(),
});

export const schema = {
  clients,
  cases,
  requirementTypes,
  requirements,
  documents,
  events,
  drafts,
  tasks,
};
