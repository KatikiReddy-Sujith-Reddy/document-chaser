import { describe, expect, it } from "vitest";
import { evaluateGaps, type CaseDocument, type RequirementType } from "../src/rules/gapEngine.js";
import { planFollowUps } from "../src/rules/followUp.js";
import { calculateMetrics } from "../src/rules/metrics.js";

const asOfDate = "2026-11-12";
const types: RequirementType[] = [
  { code: "ADDR", label: "Business address", appliesTo: "corporate", reasonText: "Required for corporate clients.", maxAgeDays: null },
  { code: "DIR", label: "Register of directors", appliesTo: "corporate", reasonText: "Must be dated within the last 90 days.", maxAgeDays: 90 },
  { code: "FIN", label: "Financial statements", appliesTo: "corporate", reasonText: "Required for the business profile.", maxAgeDays: null },
  { code: "INC", label: "Certificate of incorporation", appliesTo: "corporate", reasonText: "Required for corporate clients.", maxAgeDays: null },
];

function evaluateOne(code: string, document: Partial<CaseDocument> | null) {
  return evaluateGaps({
    clientType: "corporate",
    requirements: [{ id: `req-${code}`, requirementCode: code, requestedOn: null, receivedOn: null }],
    documents: document
      ? [{
          id: document.id ?? `doc-${code}`,
          requirementCode: code,
          issuedOn: document.issuedOn ?? null,
          expiresOn: document.expiresOn ?? null,
          legible: document.legible ?? true,
          submittedOn: document.submittedOn ?? asOfDate,
        }]
      : [],
    requirementTypes: types.filter((type) => type.code === code),
    asOfDate,
  });
}

describe("gap engine", () => {
  it("reports a missing document with its requirement reference and reason", () => {
    const result = evaluateOne("INC", null);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toMatchObject({
      requirementCode: "INC",
      requirementId: "req-INC",
      status: "missing",
      reason: "Required for corporate clients.",
    });
  });

  it("marks an expired document for resubmission", () => {
    const result = evaluateOne("ADDR", { expiresOn: "2026-11-11" });
    expect(result.needs_resubmission[0]?.reason).toContain("expired on 2026-11-11");
  });

  it("marks an illegible document for resubmission without judging authenticity", () => {
    const result = evaluateOne("ADDR", { legible: false });
    expect(result.needs_resubmission[0]?.reason).toContain("marked as illegible");
    expect(result.needs_resubmission[0]?.reason).not.toMatch(/authentic|fraud/i);
  });

  it("applies the 90-day register rule only when the document is older than 90 days", () => {
    const exactly90DaysAgo = "2026-08-14";
    const oneDayOver = "2026-08-13";
    expect(evaluateOne("DIR", { issuedOn: exactly90DaysAgo }).received).toHaveLength(1);
    const stale = evaluateOne("DIR", { issuedOn: oneDayOver });
    expect(stale.needs_resubmission[0]?.reason).toContain("older than the 90-day limit");
  });
});

describe("follow-up rules", () => {
  const evaluateAt = (days: number, replyDates: string[] = [], existingTasks = []) =>
    planFollowUps({
      approvedOn: "2026-11-10",
      asOfDate: new Date(Date.parse("2026-11-10T00:00:00.000Z") + days * 86_400_000)
        .toISOString()
        .slice(0, 10),
      clientReplyDates: replyDates,
      existingTasks,
    });

  it("does not create tasks on day 2", () => {
    expect(evaluateAt(2).tasksToCreate).toEqual([]);
    expect(evaluateAt(2).parkCase).toBe(false);
  });

  it("creates the reminder on day 3", () => {
    expect(evaluateAt(3).tasksToCreate).toEqual([
      { type: "reminder", dueOn: "2026-11-13" },
    ]);
  });

  it("creates the call on day 5 while retaining the day-3 reminder", () => {
    expect(evaluateAt(5).tasksToCreate).toEqual([
      { type: "reminder", dueOn: "2026-11-13" },
      { type: "call", dueOn: "2026-11-15" },
    ]);
  });

  it("parks the case on day 7", () => {
    expect(evaluateAt(7).parkCase).toBe(true);
  });

  it("cancels open tasks and stops the rules after a client reply", () => {
    const result = evaluateAt(7, ["2026-11-12"], [
      { id: "task-1", type: "reminder", dueOn: "2026-11-13", doneOn: null, cancelledOn: null },
      { id: "task-2", type: "call", dueOn: "2026-11-15", doneOn: "2026-11-15", cancelledOn: null },
    ]);
    expect(result.tasksToCreate).toEqual([]);
    expect(result.taskIdsToCancel).toEqual(["task-1"]);
    expect(result.parkCase).toBe(false);
  });

  it("does not duplicate tasks already present", () => {
    const result = evaluateAt(5, [], [
      { id: "task-1", type: "reminder", dueOn: "2026-11-13", doneOn: null, cancelledOn: null },
    ]);
    expect(result.tasksToCreate).toEqual([{ type: "call", dueOn: "2026-11-15" }]);
  });
});

describe("metrics", () => {
  it("computes the median cycle time from received requirements", () => {
    const result = calculateMetrics({
      requirements: [
        { caseId: "A", requestedOn: "2026-11-01", receivedOn: "2026-11-03", status: "received" },
        { caseId: "A", requestedOn: "2026-11-01", receivedOn: "2026-11-05", status: "received" },
        { caseId: "B", requestedOn: "2026-11-01", receivedOn: "2026-11-08", status: "received" },
        { caseId: "B", requestedOn: "2026-11-01", receivedOn: null, status: "missing" },
      ],
      events: [
        { caseId: "A", type: "requested" },
        { caseId: "A", type: "requested" },
        { caseId: "B", type: "requested" },
      ],
      caseIds: ["A", "B"],
      baselineMedianDays: 17,
      baselineRounds: 3,
    });

    expect(result).toEqual({
      baseline: { medianDays: 17, rounds: 3 },
      pilotMedianDays: 4,
      roundsPerCase: [{ caseId: "A", rounds: 2 }, { caseId: "B", rounds: 1 }],
    });
  });
});
