import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ApiCase } from "../api/types";
import { Badge, ErrorNotice, Loading, PageHeading, Panel } from "../components/Ui";

export function CaseQueueScreen({ onOpenCase }: { onOpenCase: (caseId: string) => void }) {
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.listCases()
      .then((result) => {
        if (active) setCases(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load cases.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cases;
    return cases.filter((item) =>
      `${item.id} ${item.clientName} ${item.rmName}`.toLowerCase().includes(normalized),
    );
  }, [cases, query]);
  const openCount = cases.reduce((total, item) => total + item.openGapCount, 0);
  const awaitingCount = cases.filter((item) => item.status === "awaiting_client").length;

  return (
    <main className="screen" data-testid="case-queue-screen">
      <PageHeading
        eyebrow="Portfolio operations"
        title="Case queue"
        description="A single view of synthetic onboarding cases and their outstanding document gaps."
      />
      {error && <ErrorNotice message={error} />}
      <div className="stats-grid">
        <Panel className="stat-card">
          <span className="stat-label">Open cases</span>
          <strong>{loading ? "--" : cases.length.toString().padStart(2, "0")}</strong>
          <span className="stat-note">Synthetic records</span>
        </Panel>
        <Panel className="stat-card">
          <span className="stat-label">Open gaps</span>
          <strong>{loading ? "--" : openCount.toString().padStart(2, "0")}</strong>
          <span className="stat-note">Missing or needs resubmission</span>
        </Panel>
        <Panel className="stat-card">
          <span className="stat-label">Awaiting client</span>
          <strong>{loading ? "--" : awaitingCount.toString().padStart(2, "0")}</strong>
          <span className="stat-note">No automatic messages</span>
        </Panel>
      </div>

      <Panel className="queue-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Onboarding operations</p>
            <h2>Active cases</h2>
          </div>
          <label className="search-field">
            <span className="sr-only">Filter cases</span>
            <input
              aria-label="Filter cases"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by client, case, or RM"
              value={query}
            />
          </label>
        </div>
        {loading ? <Loading label="Loading cases..." /> : (
          <div className="case-list">
            {filteredCases.map((item) => (
              <button
                className="case-row"
                key={item.id}
                onClick={() => onOpenCase(item.id)}
                type="button"
              >
                <span className="case-row-main">
                  <span className="case-code">{item.id}</span>
                  <strong>{item.clientName}</strong>
                  <span className="muted">{item.rmName}</span>
                </span>
                <span className="case-row-status">
                  <Badge tone={item.status === "awaiting_client" ? "warm" : "neutral"}>
                    {item.status.replaceAll("_", " ")}
                  </Badge>
                  <span className="gap-count">{item.openGapCount} open gaps</span>
                </span>
                <span className="case-open-label">View case</span>
              </button>
            ))}
            {filteredCases.length === 0 && <p className="empty-state">No matching cases.</p>}
          </div>
        )}
      </Panel>
    </main>
  );
}
