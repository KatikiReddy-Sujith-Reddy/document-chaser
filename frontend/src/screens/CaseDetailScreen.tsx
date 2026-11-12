import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApiGap, CaseDetail } from "../api/types";
import { Badge, ErrorNotice, Loading, PageHeading, Panel } from "../components/Ui";

function RequirementList({ title, items, tone }: { title: string; items: ApiGap[]; tone: string }) {
  return (
    <section className="requirement-section">
      <div className="section-title">
        <h3>{title}</h3>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      {items.length === 0 ? <p className="muted compact">No items in this group.</p> : (
        <div className="requirement-list">
          {items.map((item) => (
            <article className="requirement-row" key={item.requirementCode}>
              <span className={`status-mark mark-${item.status}`} aria-hidden="true" />
              <div className="requirement-copy">
                <div className="requirement-title">
                  <strong>{item.label}</strong>
                  <Badge tone={tone}>{item.status.replaceAll("_", " ")}</Badge>
                </div>
                <p>{item.reason}</p>
                {item.document?.issuedOn && <span className="muted compact">Issued {item.document.issuedOn}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CaseDetailScreen({
  caseId,
  onReview,
}: {
  caseId: string;
  onReview: (caseId: string) => void;
}) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [notice, setNotice] = useState("");
  const [receiving, setReceiving] = useState(false);

  const reload = () => api.getCase(caseId).then((value) => {
    setDetail(value);
    setSelectedCode((current) => current || value.requirements.find((item) => item.status !== "received")?.requirementCode || "");
  });

  useEffect(() => {
    let active = true;
    api.getCase(caseId)
      .then((value) => {
        if (active) {
          setDetail(value);
          setSelectedCode(value.requirements.find((item) => item.status !== "received")?.requirementCode ?? "");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load case.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseId]);

  async function recordReceived(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode) return;
    setReceiving(true);
    setError("");
    try {
      await api.receiveDocument(`${caseId.toLowerCase()}-${selectedCode.toLowerCase()}-${Date.now()}`, {
        caseId,
        requirementCode: selectedCode,
        ...(issuedOn ? { issuedOn } : {}),
      });
      setNotice("Document received and checklist updated.");
      setIssuedOn("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record the document.");
    } finally {
      setReceiving(false);
    }
  }

  if (loading) return <main className="screen" data-testid="case-detail-screen"><Loading label="Loading case..." /></main>;
  if (!detail) return <main className="screen" data-testid="case-detail-screen"><ErrorNotice message={error || "Case unavailable."} /></main>;

  const { missing, needs_resubmission: needsResubmission, received } = detail.requirements.reduce<{
    missing: ApiGap[];
    needs_resubmission: ApiGap[];
    received: ApiGap[];
  }>((groups, item) => {
    groups[item.status].push(item);
    return groups;
  }, { missing: [], needs_resubmission: [], received: [] });
  const openItems = [...missing, ...needsResubmission];

  return (
    <main className="screen" data-testid="case-detail-screen">
      <PageHeading
        eyebrow={`Case checklist / ${detail.case.id}`}
        title={detail.client.name}
        description={`${detail.client.clientType} onboarding. Every requirement is shown with its checklist reason.`}
        actions={<button className="button button-primary" onClick={() => onReview(caseId)} type="button">Review request</button>}
      />
      {error && <ErrorNotice message={error} />}
      {notice && <p className="success-note" role="status">{notice}</p>}

      <Panel className="case-hero">
        <div className="case-hero-title">
          <div>
            <p className="eyebrow">Synthetic case</p>
            <h2>{detail.case.id}</h2>
          </div>
          <Badge tone={detail.case.status === "awaiting_client" ? "warm" : "neutral"}>
            {detail.case.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <div className="case-meta-grid">
          <div><span>Relationship manager</span><strong>{detail.case.rmName}</strong></div>
          <div><span>Case opened</span><strong>{detail.case.openedOn}</strong></div>
          <div><span>Open gaps</span><strong>{detail.gapCounts.open}</strong></div>
          <div><span>Checklist</span><strong>{detail.requirements.length} requirements</strong></div>
        </div>
        <div className="readiness-bar" aria-label={`${detail.gapCounts.received} of ${detail.requirements.length} received`}>
          <span style={{ width: `${detail.requirements.length ? detail.gapCounts.received / detail.requirements.length * 100 : 0}%` }} />
        </div>
        <p className="muted compact">{detail.gapCounts.received} received / {detail.requirements.length} total</p>
      </Panel>

      <Panel>
        <RequirementList title="Missing" items={missing} tone="red" />
        <RequirementList title="Needs resubmission" items={needsResubmission} tone="warm" />
        <RequirementList title="Received" items={received} tone="blue" />
      </Panel>

      <Panel className="demo-control">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Demo control</p>
            <h2>Record a document received</h2>
          </div>
        </div>
        <form className="inline-form" onSubmit={recordReceived}>
          <label>
            Requirement
            <select onChange={(event) => setSelectedCode(event.target.value)} value={selectedCode}>
              {openItems.map((item) => <option key={item.requirementCode} value={item.requirementCode}>{item.label}</option>)}
              {openItems.length === 0 && <option value="">No open gaps</option>}
            </select>
          </label>
          <label>
            Issue date (when applicable)
            <input
              onChange={(event) => setIssuedOn(event.target.value)}
              required={selectedCode === "DIR"}
              type="date"
              value={issuedOn}
            />
          </label>
          <button className="button button-secondary" disabled={!selectedCode || receiving} type="submit">
            {receiving ? "Recording..." : "Record received"}
          </button>
        </form>
      </Panel>
    </main>
  );
}
