import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectRoot } from "../src/config.js";
import { createApp } from "../src/app.js";
import { seedDatabase } from "../src/db/seed.js";
import { schema } from "../src/db/schema.js";
import type { DraftPromptInput } from "../src/services/draftService.js";

describe("Document Chaser API", () => {
  let sqlite: Database.Database;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let app: ReturnType<typeof createApp>;
  let draftInput: DraftPromptInput | undefined;

  beforeEach(async () => {
    sqlite = new Database(":memory:");
    database = drizzle(sqlite, { schema });
    migrate(database, {
      migrationsFolder: path.join(projectRoot, "backend", "src", "db", "migrations"),
    });
    await seedDatabase(database, false);
    draftInput = undefined;
    app = createApp({
      database,
      generateDraft: async (input) => {
        draftInput = input;
        return {
          subject: `Documents requested for ${input.caseId}`,
          body: `Please provide: ${input.items.map((item) => `${item.label} — ${item.reason}`).join("; ")} by November 20, 2026.`,
          source: "template",
        };
      },
      runtime: {
        asOfDate: "2026-11-12",
        baselineMedianDays: 17,
        baselineRounds: 3,
      },
    });
  });

  afterEach(() => {
    sqlite.close();
    vi.restoreAllMocks();
  });

  it("lists cases with current open gap counts", async () => {
    const response = await request(app).get("/api/cases").expect(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "CS-1041", openGapCount: 4, isSynthetic: true }),
      expect.objectContaining({ id: "CS-1047", openGapCount: 1, isSynthetic: true }),
      expect.objectContaining({ id: "CS-1052", openGapCount: 5, isSynthetic: true }),
    ]));
  });

  it("returns case detail and the complete categorized gap list", async () => {
    const detail = await request(app).get("/api/cases/CS-1041").expect(200);
    expect(detail.body.case.id).toBe("CS-1041");
    expect(detail.body.requirements).toHaveLength(10);
    expect(detail.body.gapCounts).toEqual({
      missing: 3,
      needsResubmission: 1,
      received: 6,
      open: 4,
    });

    const gaps = await request(app).get("/api/cases/CS-1041/gaps").expect(200);
    expect(gaps.body.missing).toHaveLength(3);
    expect(gaps.body.needs_resubmission).toHaveLength(1);
    expect(gaps.body.received).toHaveLength(6);
  });

  it("generates a draft using every open gap exactly once", async () => {
    const response = await request(app).post("/api/cases/CS-1041/draft").send({}).expect(200);
    expect(response.body.source).toBe("template");
    expect(response.body.responseDate).toBe("2026-11-20");
    expect(draftInput?.items).toHaveLength(4);
    expect(response.body.body).toContain("Register of directors");
  });

  it("saves RM edits and approves without any outbound fetch", async () => {
    await request(app).post("/api/cases/CS-1041/draft").send({}).expect(200);
    const edited = await request(app).put("/api/cases/CS-1041/draft")
      .send({ subject: "Updated request", body: "Please send the four outstanding items by November 20, 2026." })
      .expect(200);
    expect(edited.body.edited).toBe(true);

    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      const approval = await request(app).post("/api/cases/CS-1041/approve").send({}).expect(200);
      expect(approval.body).toMatchObject({
        status: "awaiting_client",
        approvedOn: "2026-11-12",
      });
      expect(approval.body.mailtoUrl).toContain("mailto:client+cs-1041@example.test");
      expect(approval.body.mailtoUrl).toContain("subject=Updated%20request");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }

    const casesResponse = await request(app).get("/api/cases").expect(200);
    expect(casesResponse.body.find((item: { id: string }) => item.id === "CS-1041").status)
      .toBe("awaiting_client");
  });

  it("holds a case for RM review without approval or mail handoff", async () => {
    const response = await request(app).post("/api/cases/CS-1047/hold").send({}).expect(200);
    expect(response.body).toEqual({ caseId: "CS-1047", status: "ready_for_review", held: true });
  });

  it("records a received document and re-evaluates the gaps", async () => {
    const received = await request(app).post("/api/demo/documents/1041-own-new/receive")
      .send({ caseId: "CS-1041", requirementCode: "OWN" })
      .expect(201);
    expect(received.body).toMatchObject({ status: "received", receivedOn: "2026-11-12" });
    const gaps = await request(app).get("/api/cases/CS-1041/gaps").expect(200);
    expect(gaps.body.missing).toHaveLength(2);
    expect(gaps.body.received).toHaveLength(7);
  });

  it("sets the demo as-of date and creates a reminder at day 3 idempotently", async () => {
    await request(app).get("/api/tasks").expect(200).expect((response) => {
      expect(response.body).toHaveLength(0);
    });
    await request(app).post("/api/demo/as-of").send({ date: "2026-11-13" }).expect(200)
      .expect({ asOfDate: "2026-11-13" });

    const firstRead = await request(app).get("/api/tasks").expect(200);
    const secondRead = await request(app).get("/api/tasks").expect(200);
    expect(firstRead.body).toHaveLength(1);
    expect(firstRead.body[0]).toMatchObject({
      caseId: "CS-1052",
      type: "reminder",
      dueOn: "2026-11-13",
    });
    expect(secondRead.body).toHaveLength(1);

    const complete = await request(app).post(`/api/tasks/${firstRead.body[0].id}/done`).send({}).expect(200);
    expect(complete.body.doneOn).toBe("2026-11-13");
  });

  it("cancels follow-up tasks after a recorded client reply", async () => {
    await request(app).post("/api/demo/as-of").send({ date: "2026-11-13" }).expect(200);
    await request(app).get("/api/tasks").expect(200);
    await request(app).post("/api/demo/cases/CS-1052/reply").send({}).expect(201);
    const tasks = await request(app).get("/api/tasks").expect(200);
    expect(tasks.body).toHaveLength(0);
  });

  it("returns baseline and pilot metrics from the same cycle-time definition", async () => {
    const response = await request(app).get("/api/metrics").expect(200);
    expect(response.body.baseline).toEqual({ medianDays: 17, rounds: 3 });
    expect(typeof response.body.pilotMedianDays).toBe("number");
    expect(response.body.roundsPerCase).toEqual([
      { caseId: "CS-1041", rounds: 3 },
      { caseId: "CS-1047", rounds: 0 },
      { caseId: "CS-1052", rounds: 3 },
    ]);
  });

  it("returns the documented error shape for missing cases", async () => {
    const response = await request(app).get("/api/cases/CS-9999").expect(404);
    expect(response.body).toEqual({
      error: { code: "CASE_NOT_FOUND", message: "Case CS-9999 was not found." },
    });
  });

  it("re-seeds the fixed synthetic cases and clears their demo-only state", async () => {
    await request(app).post("/api/cases/CS-1041/hold").send({}).expect(200);
    await seedDatabase(database, false);

    const casesResponse = await request(app).get("/api/cases").expect(200);
    expect(casesResponse.body.find((item: { id: string }) => item.id === "CS-1041"))
      .toMatchObject({ status: "ready_for_review", openGapCount: 4 });
    const detailResponse = await request(app).get("/api/cases/CS-1041").expect(200);
    expect(detailResponse.body.draft).toBeNull();
  });
});
