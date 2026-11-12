export type MetricRequirement = {
  caseId: string;
  requestedOn: string | null;
  receivedOn: string | null;
  status: "missing" | "needs_resubmission" | "received";
};

export type RequestEvent = {
  caseId: string;
  type: string;
};

export type Metrics = {
  baseline: {
    medianDays: number;
    rounds: number;
  };
  pilotMedianDays: number | null;
  roundsPerCase: Array<{ caseId: string; rounds: number }>;
};

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00.000Z`);
  const endTime = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error("Dates must use the YYYY-MM-DD format");
  }
  return Math.floor((endTime - startTime) / 86_400_000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function calculateMetrics(input: {
  requirements: MetricRequirement[];
  events: RequestEvent[];
  caseIds: string[];
  baselineMedianDays: number;
  baselineRounds: number;
}): Metrics {
  const cycleTimes = input.requirements
    .filter(
      (requirement) =>
        requirement.status === "received" &&
        requirement.requestedOn !== null &&
        requirement.receivedOn !== null,
    )
    .map((requirement) => daysBetween(requirement.requestedOn!, requirement.receivedOn!));

  const requestCounts = new Map<string, number>();
  for (const event of input.events) {
    if (event.type === "requested") {
      requestCounts.set(event.caseId, (requestCounts.get(event.caseId) ?? 0) + 1);
    }
  }

  return {
    baseline: {
      medianDays: input.baselineMedianDays,
      rounds: input.baselineRounds,
    },
    pilotMedianDays: median(cycleTimes),
    roundsPerCase: [...new Set(input.caseIds)]
      .sort()
      .map((caseId) => ({ caseId, rounds: requestCounts.get(caseId) ?? 0 })),
  };
}
