export type RequirementType = {
  code: string;
  label: string;
  appliesTo: "corporate" | "individual";
  reasonText: string;
  maxAgeDays: number | null;
};

export type CaseRequirement = {
  id: string;
  requirementCode: string;
  requestedOn: string | null;
  receivedOn: string | null;
};

export type CaseDocument = {
  id: string;
  requirementCode: string;
  issuedOn: string | null;
  expiresOn: string | null;
  legible: boolean;
  submittedOn: string;
};

export type GapStatus = "missing" | "needs_resubmission" | "received";

export type GapItem = {
  requirementId: string | null;
  requirementCode: string;
  label: string;
  status: GapStatus;
  reason: string;
  document: CaseDocument | null;
};

export type GapGroups = {
  missing: GapItem[];
  needs_resubmission: GapItem[];
  received: GapItem[];
};

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00.000Z`);
  const endTime = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error("Dates must use the YYYY-MM-DD format");
  }
  return Math.floor((endTime - startTime) / 86_400_000);
}

function latestDocument(documents: CaseDocument[]): CaseDocument | null {
  return [...documents].sort((a, b) => b.submittedOn.localeCompare(a.submittedOn))[0] ?? null;
}

export function evaluateGaps(input: {
  clientType: "corporate" | "individual";
  requirements: CaseRequirement[];
  documents: CaseDocument[];
  requirementTypes: RequirementType[];
  asOfDate: string;
}): GapGroups {
  const groups: GapGroups = { missing: [], needs_resubmission: [], received: [] };
  const applicableTypes = input.requirementTypes
    .filter((type) => type.appliesTo === input.clientType)
    .sort((a, b) => a.code.localeCompare(b.code));

  for (const type of applicableTypes) {
    const requirement = input.requirements.find((item) => item.requirementCode === type.code);
    const document = latestDocument(
      input.documents.filter((item) => item.requirementCode === type.code),
    );

    if (!document) {
      groups.missing.push({
        requirementId: requirement?.id ?? null,
        requirementCode: type.code,
        label: type.label,
        status: "missing",
        reason: type.reasonText,
        document: null,
      });
      continue;
    }

    const issues: string[] = [];
    if (type.maxAgeDays !== null && document.issuedOn) {
      const age = daysBetween(document.issuedOn, input.asOfDate);
      if (age > type.maxAgeDays) {
        issues.push(
          `The document was issued ${age} days ago and is older than the ${type.maxAgeDays}-day limit.`,
        );
      }
    }
    if (document.expiresOn && document.expiresOn < input.asOfDate) {
      issues.push(`The document expired on ${document.expiresOn}.`);
    }
    if (!document.legible) {
      issues.push("The submitted document is marked as illegible.");
    }

    if (issues.length > 0) {
      groups.needs_resubmission.push({
        requirementId: requirement?.id ?? null,
        requirementCode: type.code,
        label: type.label,
        status: "needs_resubmission",
        reason: `${issues.join(" ")} ${type.reasonText}`,
        document,
      });
    } else {
      groups.received.push({
        requirementId: requirement?.id ?? null,
        requirementCode: type.code,
        label: type.label,
        status: "received",
        reason: type.reasonText,
        document,
      });
    }
  }

  return groups;
}
