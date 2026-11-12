export type CaseStatus =
  | "open"
  | "awaiting_client"
  | "ready_for_review"
  | "complete"
  | "parked";

export type GapStatus = "missing" | "needs_resubmission" | "received";

export type ApiCase = {
  id: string;
  clientName: string;
  clientType: "corporate" | "individual";
  rmName: string;
  openedOn: string;
  approvedOn: string | null;
  status: CaseStatus;
  openGapCount: number;
  isSynthetic: boolean;
};

export type ApiGap = {
  requirementId: string | null;
  requirementCode: string;
  label: string;
  status: GapStatus;
  reason: string;
  document: {
    id: string;
    issuedOn: string | null;
    expiresOn: string | null;
    legible: boolean;
    submittedOn: string;
  } | null;
};

export type GapGroups = {
  missing: ApiGap[];
  needs_resubmission: ApiGap[];
  received: ApiGap[];
};

export type ApiDraft = {
  caseId?: string;
  subject: string;
  body: string;
  source: "gemini" | "template";
  edited?: boolean;
  updatedOn?: string;
};

export type CaseDetail = {
  case: {
    id: string;
    rmName: string;
    openedOn: string;
    approvedOn: string | null;
    status: CaseStatus;
    isSynthetic: boolean;
  };
  client: {
    id: string;
    name: string;
    clientType: "corporate" | "individual";
    isSynthetic: boolean;
  };
  requirements: ApiGap[];
  gapCounts: {
    missing: number;
    needsResubmission: number;
    received: number;
    open: number;
  };
  draft: ApiDraft | null;
};

export type ApiTask = {
  id: string;
  caseId: string;
  type: "reminder" | "call";
  dueOn: string;
  doneOn: string | null;
  cancelledOn: string | null;
  isSynthetic: boolean;
};

export type Metrics = {
  baseline: {
    medianDays: number;
    rounds: number;
  };
  pilotMedianDays: number | null;
  roundsPerCase: Array<{ caseId: string; rounds: number }>;
};

export type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};
