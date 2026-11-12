import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Metrics } from "../api/types";
import { ErrorNotice, Loading, PageHeading, Panel } from "../components/Ui";

export function MetricsScreen() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.getMetrics()
      .then((result) => {
        if (active) setMetrics(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load metrics.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="screen" data-testid="metrics-screen">
      <PageHeading
        eyebrow="Cycle-time measurement"
        title="Metrics"
        description="The baseline and synthetic pilot use the same request-to-receipt definition."
      />
      {error && <ErrorNotice message={error} />}
      {!metrics ? (error ? null : <Loading label="Loading metrics..." />) : (
        <>
          <div className="metrics-grid">
            <Panel className="metric-card metric-primary">
              <p className="eyebrow">Median days, request to received</p>
              <div className="metric-comparison">
                <div>
                  <span className="stat-label">Historic baseline</span>
                  <strong>{metrics.baseline.medianDays}</strong>
                  <span>days</span>
                </div>
                <div>
                  <span className="stat-label">Synthetic pilot</span>
                  <strong>{metrics.pilotMedianDays ?? "--"}</strong>
                  <span>{metrics.pilotMedianDays === null ? "no received data" : "days"}</span>
                </div>
              </div>
              <div className="comparison-track">
                <span style={{
                  width: `${metrics.pilotMedianDays === null ? 0 : Math.min(100, metrics.pilotMedianDays / metrics.baseline.medianDays * 100)}%`,
                }} />
              </div>
              <p className="muted compact">Pilot median is calculated from received requirements in the synthetic seed.</p>
            </Panel>

            <Panel className="metric-card">
              <p className="eyebrow">Chasing rounds per case</p>
              <strong className="large-number">{metrics.baseline.rounds}</strong>
              <span className="muted">Baseline rounds</span>
              <div className="rounds-list">
                {metrics.roundsPerCase.map((item) => (
                  <div className="round-row" key={item.caseId}>
                    <span>{item.caseId}</span>
                    <strong>{item.rounds}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Panel className="definition-panel">
            <div><p className="eyebrow">Measurement definition</p><h2>One consistent formula</h2></div>
            <p>Cycle time is the whole calendar days from the requested date to the received date, calculated for received requirements only. A request round is a recorded requested event.</p>
          </Panel>
        </>
      )}
    </main>
  );
}
