import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApiDraft, CaseDetail, GapGroups } from "../api/types";
import { Badge, ErrorNotice, Loading, PageHeading, Panel } from "../components/Ui";

export function ReviewScreen({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [gaps, setGaps] = useState<GapGroups | null>(null);
  const [draft, setDraft] = useState<ApiDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mailtoUrl, setMailtoUrl] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.getCase(caseId), api.getGaps(caseId)])
      .then(([caseDetail, caseGaps]) => {
        if (active) {
          setDetail(caseDetail);
          setGaps(caseGaps);
          setDraft(caseDetail.draft);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load review.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseId]);

  async function generateDraft() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const generated = await api.generateDraft(caseId);
      setDraft(generated);
      setEditing(false);
      setNotice(generated.source === "template" ? "Template draft ready for RM review." : "Draft ready for RM review.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate a draft.");
    } finally {
      setWorking(false);
    }
  }

  async function saveEdits() {
    if (!draft) return;
    setWorking(true);
    setError("");
    try {
      const saved = await api.saveDraft(caseId, { subject: draft.subject, body: draft.body });
      setDraft(saved);
      setEditing(false);
      setNotice("Edits saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save edits.");
    } finally {
      setWorking(false);
    }
  }

  async function approveAndOpenMail() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await api.approve(caseId);
      setMailtoUrl(result.mailtoUrl);
      setNotice("Approved. Your email client will open; nothing was sent by Document Chaser.");
      window.open(result.mailtoUrl, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve this draft.");
    } finally {
      setWorking(false);
    }
  }

  async function holdForReview() {
    setWorking(true);
    setError("");
    try {
      await api.hold(caseId);
      setNotice("Held for RM review. No email was opened.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not hold this case.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <main className="screen" data-testid="rm-review-screen"><Loading label="Loading RM review..." /></main>;
  if (!detail || !gaps) return <main className="screen" data-testid="rm-review-screen"><ErrorNotice message={error || "Review unavailable."} /></main>;

  const openItems = [...gaps.missing, ...gaps.needs_resubmission];

  return (
    <main className="screen" data-testid="rm-review-screen">
      <PageHeading
        eyebrow={`RM review / ${detail.case.id}`}
        title="Request review"
        description={`${detail.client.name} / ${detail.case.rmName}`}
      />
      <div className="safeguard-banner">
        <span className="safeguard-mark" aria-hidden="true">!</span>
        <div>
          <strong>Nothing is sent automatically.</strong>
          <p>Review and approve the draft, then send it from your own email client.</p>
        </div>
      </div>
      {error && <ErrorNotice message={error} />}
      {notice && <p className="success-note" role="status">{notice}</p>}

      <div className="review-grid">
        <Panel className="gap-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Document gap analysis</p><h2>{openItems.length} open items</h2></div>
            <Badge tone="red">Review required</Badge>
          </div>
          <div className="requirement-list">
            {openItems.map((item) => (
              <article className="gap-card" key={item.requirementCode}>
                <div className="requirement-title">
                  <strong>{item.label}</strong>
                  <Badge tone={item.status === "missing" ? "red" : "warm"}>
                    {item.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p>{item.reason}</p>
              </article>
            ))}
          </div>
          <div className="review-meta">
            <span>Relationship manager</span>
            <strong>{detail.case.rmName}</strong>
          </div>
        </Panel>

        <Panel className="draft-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Client email draft</p><h2>Consolidated request</h2></div>
            {draft && <Badge tone="blue">{draft.source === "template" ? "Template" : "Gemini"}</Badge>}
          </div>
          {!draft ? (
            <div className="draft-empty">
              <p>Generate one draft from the current gap list. It remains editable before approval.</p>
              <button className="button button-primary" disabled={working} onClick={generateDraft} type="button">
                {working ? "Generating..." : "Generate draft"}
              </button>
            </div>
          ) : (
            <>
              <label className="field-label">
                Subject
                <input
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                  readOnly={!editing}
                  value={draft.subject}
                />
              </label>
              <label className="field-label">
                Body
                <textarea
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  readOnly={!editing}
                  rows={13}
                  value={draft.body}
                />
              </label>
              <p className="draft-note">Check that each open item and reason appears once, with one response date.</p>
              <div className="draft-actions">
                <button className="button button-secondary" disabled={working} onClick={generateDraft} type="button">
                  Regenerate
                </button>
                {editing ? (
                  <button className="button button-secondary" disabled={working} onClick={saveEdits} type="button">
                    Save edits
                  </button>
                ) : (
                  <button className="button button-secondary" onClick={() => setEditing(true)} type="button">
                    Edit
                  </button>
                )}
              </div>
              {mailtoUrl && <a className="mailto-link" href={mailtoUrl}>Open approved email draft</a>}
            </>
          )}
        </Panel>

        <Panel className="decision-panel">
          <p className="eyebrow">RM decision gate</p>
          <button
            className="button button-approve"
            disabled={!draft || working || editing}
            onClick={approveAndOpenMail}
            type="button"
          >
            Approve and send
            <span className="button-subtitle">Opens your email client; you send manually.</span>
          </button>
          <button className="button button-secondary button-full" disabled={working} onClick={holdForReview} type="button">
            Hold
          </button>
          <div className="decision-note">
            <strong>Manual approval</strong>
            <p>The case status changes only after RM approval. No message is sent by this prototype.</p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
