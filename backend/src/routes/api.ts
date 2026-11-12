import { and, eq, inArray, lte } from "drizzle-orm";
import { Router } from "express";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { calculateMetrics } from "../rules/metrics.js";
import { evaluateGaps, type GapGroups } from "../rules/gapEngine.js";
import { planFollowUps, type FollowUpTask } from "../rules/followUp.js";
import { cases, clients, documents, drafts, events, requirements, requirementTypes, schema, tasks } from "../db/schema.js";
import type { DraftPromptInput, Draft } from "../services/draftService.js";

type AppDatabase = BetterSQLite3Database<typeof schema>;
type DraftCreator = (input: DraftPromptInput) => Promise<Draft>;

export type ApiDependencies = {
  database: AppDatabase;
  generateDraft: DraftCreator;
  runtime: {
    asOfDate: string;
    baselineMedianDays: number;
    baselineRounds: number;
  };
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Must be a valid YYYY-MM-DD date");

const draftEditSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
}).strict();

const receiveDocumentSchema = z.object({
  caseId: z.string().min(1),
  requirementCode: z.string().min(1),
  issuedOn: dateSchema.nullable().optional(),
  expiresOn: dateSchema.nullable().optional(),
  legible: z.boolean().default(true),
}).strict();

function parseBody<T extends z.ZodType>(schemaToUse: T, body: unknown): z.infer<T> {
  const parsed = schemaToUse.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "Request body is invalid.");
  return parsed.data;
}

function caseNotFound(caseId: string): never {
  throw new ApiError(404, "CASE_NOT_FOUND", `Case ${caseId} was not found.`);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function gapCounts(groups: GapGroups) {
  return {
    missing: groups.missing.length,
    needsResubmission: groups.needs_resubmission.length,
    received: groups.received.length,
    open: groups.missing.length + groups.needs_resubmission.length,
  };
}

export function createApiRouter(dependencies: ApiDependencies): Router {
  const { database, runtime } = dependencies;
  const router = Router();

  function getCase(caseId: string) {
    const caseRecord = database.select().from(cases).where(eq(cases.id, caseId)).get();
    if (!caseRecord) caseNotFound(caseId);
    const client = database.select().from(clients).where(eq(clients.id, caseRecord.clientId)).get();
    if (!client) throw new ApiError(500, "DATA_INTEGRITY_ERROR", "Case client record is missing.");
    return { caseRecord, client };
  }

  function getGaps(caseId: string, asOfDate = runtime.asOfDate): GapGroups {
    const { caseRecord, client } = getCase(caseId);
    const caseRequirements = database.select().from(requirements)
      .where(eq(requirements.caseId, caseId)).all();
    const caseDocuments = database.select().from(documents)
      .where(eq(documents.caseId, caseId)).all();
    const types = database.select().from(requirementTypes).all();
    return evaluateGaps({
      clientType: client.clientType,
      requirements: caseRequirements,
      documents: caseDocuments,
      requirementTypes: types,
      asOfDate,
    });
  }

  router.get("/cases", (_request, response) => {
    const allCases = database.select().from(cases).all();
    const result = allCases.map((caseRecord) => {
      const { client } = getCase(caseRecord.id);
      return {
        id: caseRecord.id,
        clientName: client.name,
        clientType: client.clientType,
        rmName: caseRecord.rmName,
        openedOn: caseRecord.openedOn,
        approvedOn: caseRecord.approvedOn,
        status: caseRecord.status,
        openGapCount: gapCounts(getGaps(caseRecord.id)).open,
        isSynthetic: caseRecord.isSynthetic && client.isSynthetic,
      };
    });
    response.json(result);
  });

  router.get("/cases/:id", (request, response) => {
    const { caseRecord, client } = getCase(request.params.id);
    const groups = getGaps(caseRecord.id);
    response.json({
      case: caseRecord,
      client,
      requirements: [...groups.missing, ...groups.needs_resubmission, ...groups.received],
      gapCounts: gapCounts(groups),
      draft: database.select().from(drafts).where(eq(drafts.caseId, caseRecord.id)).get() ?? null,
    });
  });

  router.get("/cases/:id/gaps", (request, response) => {
    response.json(getGaps(request.params.id));
  });

  router.post("/cases/:id/draft", async (request, response) => {
    const { caseRecord, client } = getCase(request.params.id);
    const groups = getGaps(caseRecord.id);
    const openItems = [...groups.missing, ...groups.needs_resubmission];
    if (openItems.length === 0) throw new ApiError(409, "NO_OPEN_GAPS", "This case has no open document gaps.");

    const input: DraftPromptInput = {
      caseId: caseRecord.id,
      clientName: client.name,
      rmName: caseRecord.rmName,
      items: openItems.map(({ label, reason }) => ({ label, reason })),
      responseDate: addDays(runtime.asOfDate, 8),
    };
    const generated = await dependencies.generateDraft(input);
    const saved = {
      caseId: caseRecord.id,
      subject: generated.subject,
      body: generated.body,
      source: generated.source,
      edited: false,
      updatedOn: runtime.asOfDate,
      isSynthetic: true,
    };
    database.insert(drafts).values(saved).onConflictDoUpdate({
      target: drafts.caseId,
      set: {
        subject: saved.subject,
        body: saved.body,
        source: saved.source,
        edited: false,
        updatedOn: saved.updatedOn,
        isSynthetic: true,
      },
    }).run();

    response.json({
      subject: generated.subject,
      body: generated.body,
      source: generated.source,
      responseDate: input.responseDate,
    });
  });

  router.put("/cases/:id/draft", (request, response) => {
    const parsed = parseBody(draftEditSchema, request.body);
    getCase(request.params.id);
    const current = database.select().from(drafts).where(eq(drafts.caseId, request.params.id)).get();
    if (!current) throw new ApiError(404, "DRAFT_NOT_FOUND", "Generate a draft before saving edits.");
    const edited = current.subject !== parsed.subject || current.body !== parsed.body;
    database.update(drafts).set({
      subject: parsed.subject,
      body: parsed.body,
      edited,
      updatedOn: runtime.asOfDate,
    }).where(eq(drafts.caseId, request.params.id)).run();
    response.json({
      caseId: request.params.id,
      subject: parsed.subject,
      body: parsed.body,
      source: current.source,
      edited,
      updatedOn: runtime.asOfDate,
    });
  });

  router.post("/cases/:id/approve", (request, response) => {
    const { caseRecord, client } = getCase(request.params.id);
    if (caseRecord.status === "awaiting_client" || caseRecord.status === "complete") {
      throw new ApiError(409, "ALREADY_APPROVED", "This case already has an approved request.");
    }
    const savedDraft = database.select().from(drafts).where(eq(drafts.caseId, caseRecord.id)).get();
    if (!savedDraft) throw new ApiError(409, "DRAFT_NOT_FOUND", "Generate and save a draft before approval.");

    const groups = getGaps(caseRecord.id);
    const openItems = [...groups.missing, ...groups.needs_resubmission];
    database.transaction((transaction) => {
      transaction.update(cases).set({
        approvedOn: runtime.asOfDate,
        status: "awaiting_client",
      }).where(eq(cases.id, caseRecord.id)).run();

      for (const gap of openItems) {
        const requirement = transaction.select().from(requirements).where(and(
          eq(requirements.caseId, caseRecord.id),
          eq(requirements.requirementCode, gap.requirementCode),
        )).get();
        if (requirement) {
          transaction.update(requirements).set({ requestedOn: runtime.asOfDate })
            .where(eq(requirements.id, requirement.id)).run();
        }
      }

      transaction.insert(events).values([
        {
          id: `approved-${caseRecord.id}-${runtime.asOfDate}`,
          caseId: caseRecord.id,
          type: "approved",
          occurredOn: runtime.asOfDate,
          payload: "{}",
          isSynthetic: true,
        },
        {
          id: `requested-${caseRecord.id}-${runtime.asOfDate}`,
          caseId: caseRecord.id,
          type: "requested",
          occurredOn: runtime.asOfDate,
          payload: "{}",
          isSynthetic: true,
        },
      ]).onConflictDoNothing().run();
    });

    const recipient = `client+${caseRecord.id.toLowerCase()}@example.test`;
    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(savedDraft.subject)}&body=${encodeURIComponent(savedDraft.body)}`;
    response.json({
      caseId: caseRecord.id,
      status: "awaiting_client",
      approvedOn: runtime.asOfDate,
      mailtoUrl,
      clientName: client.name,
    });
  });

  router.post("/cases/:id/hold", (request, response) => {
    const { caseRecord } = getCase(request.params.id);
    if (caseRecord.status === "awaiting_client" || caseRecord.status === "complete") {
      throw new ApiError(409, "CASE_NOT_REVIEWABLE", "Only an unapproved case can be held for review.");
    }
    database.transaction((transaction) => {
      transaction.update(cases).set({ status: "ready_for_review" })
        .where(eq(cases.id, caseRecord.id)).run();
      transaction.insert(events).values({
        id: `held-${caseRecord.id}-${runtime.asOfDate}`,
        caseId: caseRecord.id,
        type: "held",
        occurredOn: runtime.asOfDate,
        payload: "{}",
        isSynthetic: true,
      }).onConflictDoNothing().run();
    });
    response.json({ caseId: caseRecord.id, status: "ready_for_review", held: true });
  });

  router.post("/demo/documents/:docId/receive", (request, response) => {
    const parsed = parseBody(receiveDocumentSchema, request.body);
    const { caseRecord } = getCase(parsed.caseId);
    const requirement = database.select().from(requirements).where(and(
      eq(requirements.caseId, parsed.caseId),
      eq(requirements.requirementCode, parsed.requirementCode),
    )).get();
    if (!requirement) throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "The requirement was not found for this case.");
    const requirementType = database.select().from(requirementTypes)
      .where(eq(requirementTypes.code, parsed.requirementCode)).get();
    if (!requirementType) throw new ApiError(500, "DATA_INTEGRITY_ERROR", "Requirement type is missing.");
    if (requirementType.maxAgeDays !== null && !parsed.issuedOn) {
      throw new ApiError(400, "ISSUED_DATE_REQUIRED", "An issue date is required for this document.");
    }
    const existingDocument = database.select().from(documents)
      .where(eq(documents.id, request.params.docId)).get();
    if (existingDocument) throw new ApiError(409, "DOCUMENT_ALREADY_RECEIVED", "This document was already recorded.");

    database.transaction((transaction) => {
      transaction.insert(documents).values({
        id: request.params.docId,
        caseId: caseRecord.id,
        requirementCode: parsed.requirementCode,
        issuedOn: parsed.issuedOn ?? null,
        expiresOn: parsed.expiresOn ?? null,
        legible: parsed.legible,
        submittedOn: runtime.asOfDate,
        isSynthetic: true,
      }).run();
      transaction.update(requirements).set({
        receivedOn: runtime.asOfDate,
        status: "received",
      }).where(eq(requirements.id, requirement.id)).run();
      transaction.insert(events).values({
        id: `received-${request.params.docId}`,
        caseId: caseRecord.id,
        type: "received",
        occurredOn: runtime.asOfDate,
        payload: JSON.stringify({ requirementCode: parsed.requirementCode }),
        isSynthetic: true,
      }).run();
    });
    response.status(201).json({
      id: request.params.docId,
      caseId: caseRecord.id,
      requirementCode: parsed.requirementCode,
      receivedOn: runtime.asOfDate,
      status: "received",
      isSynthetic: true,
    });
  });

  router.post("/demo/as-of", (request, response) => {
    const parsed = parseBody(z.object({ date: dateSchema }).strict(), request.body);
    runtime.asOfDate = parsed.date;
    response.json({ asOfDate: runtime.asOfDate });
  });

  router.get("/demo/as-of", (_request, response) => {
    response.json({ asOfDate: runtime.asOfDate });
  });

  router.post("/demo/cases/:id/reply", (request, response) => {
    const { caseRecord } = getCase(request.params.id);
    if (!caseRecord.approvedOn) {
      throw new ApiError(409, "CASE_NOT_APPROVED", "Record a client reply only after an approved request.");
    }
    database.insert(events).values({
      id: `reply-${caseRecord.id}-${runtime.asOfDate}`,
      caseId: caseRecord.id,
      type: "client_reply",
      occurredOn: runtime.asOfDate,
      payload: "{}",
      isSynthetic: true,
    }).onConflictDoNothing().run();
    database.update(cases).set({ status: "ready_for_review" }).where(eq(cases.id, caseRecord.id)).run();
    response.status(201).json({ caseId: caseRecord.id, repliedOn: runtime.asOfDate });
  });

  router.get("/tasks", (_request, response) => {
    const approvedCases = database.select().from(cases).all().filter((item) => item.approvedOn !== null);
    for (const caseRecord of approvedCases) {
      const clientReplies = database.select().from(events).where(and(
        eq(events.caseId, caseRecord.id),
        eq(events.type, "client_reply"),
      )).all().map((event) => event.occurredOn);
      const existing = database.select().from(tasks).where(eq(tasks.caseId, caseRecord.id)).all();
      const plan = planFollowUps({
        approvedOn: caseRecord.approvedOn,
        asOfDate: runtime.asOfDate,
        clientReplyDates: clientReplies,
        existingTasks: existing as FollowUpTask[],
      });

      database.transaction((transaction) => {
        if (plan.taskIdsToCancel.length > 0) {
          transaction.update(tasks).set({ cancelledOn: runtime.asOfDate })
            .where(inArray(tasks.id, plan.taskIdsToCancel)).run();
        }
        for (const task of plan.tasksToCreate) {
          const taskId = `${caseRecord.id}-${task.type}-${task.dueOn}`;
          transaction.insert(tasks).values({
            id: taskId,
            caseId: caseRecord.id,
            type: task.type,
            dueOn: task.dueOn,
            doneOn: null,
            cancelledOn: null,
            isSynthetic: true,
          }).onConflictDoNothing().run();
          transaction.insert(events).values({
            id: `created-${taskId}`,
            caseId: caseRecord.id,
            type: task.type === "reminder" ? "reminder_created" : "call_created",
            occurredOn: runtime.asOfDate,
            payload: JSON.stringify({ taskId, dueOn: task.dueOn }),
            isSynthetic: true,
          }).onConflictDoNothing().run();
        }
        if (plan.parkCase && caseRecord.status !== "parked") {
          transaction.update(cases).set({ status: "parked" }).where(eq(cases.id, caseRecord.id)).run();
          transaction.insert(events).values({
            id: `parked-${caseRecord.id}-${caseRecord.approvedOn}`,
            caseId: caseRecord.id,
            type: "parked",
            occurredOn: runtime.asOfDate,
            payload: "{}",
            isSynthetic: true,
          }).onConflictDoNothing().run();
        }
      });
    }

    const due = database.select().from(tasks).where(lte(tasks.dueOn, runtime.asOfDate)).all()
      .filter((task) => task.cancelledOn === null);
    response.json(due);
  });

  router.post("/tasks/:id/done", (request, response) => {
    const task = database.select().from(tasks).where(eq(tasks.id, request.params.id)).get();
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "The follow-up task was not found.");
    if (task.cancelledOn) throw new ApiError(409, "TASK_CANCELLED", "A cancelled task cannot be completed.");
    if (!task.doneOn) {
      database.update(tasks).set({ doneOn: runtime.asOfDate }).where(eq(tasks.id, task.id)).run();
    }
    response.json({
      ...task,
      doneOn: task.doneOn ?? runtime.asOfDate,
    });
  });

  router.get("/metrics", (_request, response) => {
    const result = calculateMetrics({
      requirements: database.select().from(requirements).all(),
      events: database.select().from(events).all(),
      caseIds: database.select({ id: cases.id }).from(cases).all().map((item) => item.id),
      baselineMedianDays: runtime.baselineMedianDays,
      baselineRounds: runtime.baselineRounds,
    });
    response.json(result);
  });

  return router;
}
