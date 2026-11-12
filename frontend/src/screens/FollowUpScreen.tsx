import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApiTask } from "../api/types";
import { Badge, ErrorNotice, Loading, PageHeading, Panel } from "../components/Ui";

export function FollowUpScreen() {
  const [asOfDate, setAsOfDate] = useState("");
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.getAsOf(), api.getTasks()])
      .then(([date, result]) => {
        if (active) {
          setAsOfDate(date.asOfDate);
          setTasks(result);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load follow-up tasks.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function advanceDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const saved = await api.setAsOf(asOfDate);
      const updatedTasks = await api.getTasks();
      setAsOfDate(saved.asOfDate);
      setTasks(updatedTasks);
      setNotice(`As-of date set to ${saved.asOfDate}. Follow-up rules have been re-evaluated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the demo date.");
    } finally {
      setWorking(false);
    }
  }

  async function completeTask(task: ApiTask) {
    setWorking(true);
    setError("");
    try {
      const updated = await api.markTaskDone(task.id);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the task.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="screen" data-testid="follow-up-screen">
      <PageHeading
        eyebrow="RM task list"
        title="Follow-up tracker"
        description="Calendar-day prompts create tasks for the RM. The prototype does not contact clients."
      />
      {error && <ErrorNotice message={error} />}
      {notice && <p className="success-note" role="status">{notice}</p>}

      <Panel className="as-of-panel">
        <div>
          <p className="eyebrow">Demo control</p>
          <h2>As-of date</h2>
          <p className="muted">Advance the date to evaluate reminder, call, and parked-case rules.</p>
        </div>
        <form className="date-form" onSubmit={advanceDate}>
          <label>
            Current date
            <input
              aria-label="As-of date"
              onChange={(event) => setAsOfDate(event.target.value)}
              required
              type="date"
              value={asOfDate}
            />
          </label>
          <button className="button button-primary" disabled={loading || working} type="submit">
            {working ? "Updating..." : "Update date"}
          </button>
        </form>
      </Panel>

      <div className="followup-grid">
        <Panel>
          <div className="panel-heading">
            <div><p className="eyebrow">Approved request / CS-1052</p><h2>Follow-up sequence</h2></div>
            <Badge tone="warm">No client contact</Badge>
          </div>
          <ol className="timeline">
            <li className="timeline-item">
              <span className="timeline-dot" />
              <div><strong>Day 0 / approved</strong><p>RM approves the request and opens an email draft.</p></div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" />
              <div><strong>Day 3 / reminder task</strong><p>A reminder task appears for the RM if there is no client reply.</p></div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" />
              <div><strong>Day 5 / call task</strong><p>A call task appears for the RM if there is still no reply.</p></div>
            </li>
            <li className="timeline-item">
              <span className="timeline-dot" />
              <div><strong>Day 7 / parked</strong><p>The case is parked for review if no reply has been recorded.</p></div>
            </li>
          </ol>
        </Panel>

        <Panel>
          <div className="panel-heading">
            <div><p className="eyebrow">Due on or before {asOfDate || "..."}</p><h2>Tasks</h2></div>
            <Badge tone={tasks.length ? "red" : "neutral"}>{tasks.length}</Badge>
          </div>
          {loading ? <Loading label="Loading tasks..." /> : tasks.length === 0 ? (
            <p className="empty-state">No follow-up tasks are due yet.</p>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <article className={`task-row ${task.doneOn ? "task-done" : ""}`} key={task.id}>
                  <div>
                    <Badge tone={task.type === "reminder" ? "warm" : "blue"}>{task.type} task</Badge>
                    <strong>{task.caseId}</strong>
                    <span className="muted">Due {task.dueOn}</span>
                  </div>
                  {task.doneOn ? (
                    <span className="done-label">Done {task.doneOn}</span>
                  ) : (
                    <button className="button button-secondary" disabled={working} onClick={() => completeTask(task)} type="button">
                      Mark done
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
