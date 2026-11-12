import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseDetailScreen } from "../src/screens/CaseDetailScreen";
import { CaseQueueScreen } from "../src/screens/CaseQueueScreen";
import { FollowUpScreen } from "../src/screens/FollowUpScreen";
import { MetricsScreen } from "../src/screens/MetricsScreen";
import { ReviewScreen } from "../src/screens/ReviewScreen";
import type { CaseDetail, Metrics } from "../src/api/types";

const apiMocks = vi.hoisted(() => ({
  listCases: vi.fn(),
  getCase: vi.fn(),
  getGaps: vi.fn(),
  generateDraft: vi.fn(),
  saveDraft: vi.fn(),
  approve: vi.fn(),
  hold: vi.fn(),
  receiveDocument: vi.fn(),
  getAsOf: vi.fn(),
  setAsOf: vi.fn(),
  getTasks: vi.fn(),
  markTaskDone: vi.fn(),
  getMetrics: vi.fn(),
}));

vi.mock("../src/api/client", () => ({ api: apiMocks }));

const detail: CaseDetail = {
  case: {
    id: "CS-1041",
    rmName: "A. Patel",
    openedOn: "2026-11-03",
    approvedOn: null,
    status: "ready_for_review",
    isSynthetic: true,
  },
  client: { id: "client-lumen", name: "Lumen Textiles Ltd", clientType: "corporate", isSynthetic: true },
  requirements: [
    { requirementId: "1041-OWN", requirementCode: "OWN", label: "Ownership register", status: "missing", reason: "Required for corporate clients.", document: null },
    { requirementId: "1041-DIR", requirementCode: "DIR", label: "Register of directors", status: "needs_resubmission", reason: "Must be dated within 90 days.", document: null },
    { requirementId: "1041-INC", requirementCode: "INC", label: "Certificate of incorporation", status: "received", reason: "Required for corporate clients.", document: null },
  ],
  gapCounts: { missing: 1, needsResubmission: 1, received: 1, open: 2 },
  draft: null,
};

const metrics: Metrics = {
  baseline: { medianDays: 17, rounds: 3 },
  pilotMedianDays: 5,
  roundsPerCase: [{ caseId: "CS-1041", rounds: 3 }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("screen smoke tests", () => {
  it("renders the case queue", async () => {
    apiMocks.listCases.mockResolvedValue([
      { id: "CS-1041", clientName: "Lumen Textiles Ltd", clientType: "corporate", rmName: "A. Patel", openedOn: "2026-11-03", approvedOn: null, status: "ready_for_review", openGapCount: 2, isSynthetic: true },
    ]);
    render(<CaseQueueScreen onOpenCase={vi.fn()} />);
    expect(await screen.findByTestId("case-queue-screen")).toBeInTheDocument();
    expect(screen.getByText("Lumen Textiles Ltd")).toBeInTheDocument();
  });

  it("renders case detail and the checklist", async () => {
    apiMocks.getCase.mockResolvedValue(detail);
    render(<CaseDetailScreen caseId="CS-1041" onReview={vi.fn()} />);
    expect(await screen.findByTestId("case-detail-screen")).toBeInTheDocument();
    expect(screen.getAllByText("Register of directors").length).toBeGreaterThan(0);
  });

  it("renders RM review with the send safeguard and actions", async () => {
    apiMocks.getCase.mockResolvedValue(detail);
    apiMocks.getGaps.mockResolvedValue({
      missing: [detail.requirements[0]],
      needs_resubmission: [detail.requirements[1]],
      received: [detail.requirements[2]],
    });
    render(<ReviewScreen caseId="CS-1041" />);
    expect(await screen.findByTestId("rm-review-screen")).toBeInTheDocument();
    expect(screen.getByText("Nothing is sent automatically.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve and send/ })).toBeInTheDocument();
  });

  it("renders the follow-up tracker", async () => {
    apiMocks.getAsOf.mockResolvedValue({ asOfDate: "2026-11-12" });
    apiMocks.getTasks.mockResolvedValue([]);
    render(<FollowUpScreen />);
    expect(await screen.findByTestId("follow-up-screen")).toBeInTheDocument();
    expect(screen.getByText("Follow-up sequence")).toBeInTheDocument();
  });

  it("renders baseline and pilot metrics", async () => {
    apiMocks.getMetrics.mockResolvedValue(metrics);
    render(<MetricsScreen />);
    expect(await screen.findByTestId("metrics-screen")).toBeInTheDocument();
    expect(screen.getByText("Historic baseline")).toBeInTheDocument();
    expect(screen.getByText("CS-1041")).toBeInTheDocument();
  });
});
