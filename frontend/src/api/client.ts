import type {
  ApiCase,
  ApiDraft,
  ApiErrorResponse,
  ApiTask,
  CaseDetail,
  GapGroups,
  Metrics,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const result = await response.json() as T & ApiErrorResponse;
  if (!response.ok) {
    throw new Error(result.error?.message ?? `Request failed (${response.status}).`);
  }
  return result;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export const api = {
  listCases: () => request<ApiCase[]>("/api/cases"),
  getCase: (caseId: string) => request<CaseDetail>(`/api/cases/${encodeURIComponent(caseId)}`),
  getGaps: (caseId: string) => request<GapGroups>(`/api/cases/${encodeURIComponent(caseId)}/gaps`),
  generateDraft: (caseId: string) =>
    request<ApiDraft & { responseDate: string }>(`/api/cases/${encodeURIComponent(caseId)}/draft`, {
      method: "POST",
      body: jsonBody({}),
    }),
  saveDraft: (caseId: string, draft: Pick<ApiDraft, "subject" | "body">) =>
    request<ApiDraft>(`/api/cases/${encodeURIComponent(caseId)}/draft`, {
      method: "PUT",
      body: jsonBody(draft),
    }),
  approve: (caseId: string) =>
    request<{ caseId: string; status: string; approvedOn: string; mailtoUrl: string }>(
      `/api/cases/${encodeURIComponent(caseId)}/approve`,
      { method: "POST", body: jsonBody({}) },
    ),
  hold: (caseId: string) =>
    request<{ caseId: string; status: string; held: boolean }>(
      `/api/cases/${encodeURIComponent(caseId)}/hold`,
      { method: "POST", body: jsonBody({}) },
    ),
  receiveDocument: (
    docId: string,
    data: { caseId: string; requirementCode: string; issuedOn?: string | null },
  ) =>
    request<{ id: string; caseId: string; requirementCode: string; receivedOn: string }>(
      `/api/demo/documents/${encodeURIComponent(docId)}/receive`,
      { method: "POST", body: jsonBody(data) },
    ),
  getAsOf: () => request<{ asOfDate: string }>("/api/demo/as-of"),
  setAsOf: (date: string) =>
    request<{ asOfDate: string }>("/api/demo/as-of", {
      method: "POST",
      body: jsonBody({ date }),
    }),
  getTasks: () => request<ApiTask[]>("/api/tasks"),
  markTaskDone: (id: string) =>
    request<ApiTask>(`/api/tasks/${encodeURIComponent(id)}/done`, {
      method: "POST",
      body: jsonBody({}),
    }),
  getMetrics: () => request<Metrics>("/api/metrics"),
};
