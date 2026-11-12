import { useState } from "react";
import { CaseDetailScreen } from "./screens/CaseDetailScreen";
import { CaseQueueScreen } from "./screens/CaseQueueScreen";
import { FollowUpScreen } from "./screens/FollowUpScreen";
import { MetricsScreen } from "./screens/MetricsScreen";
import { ReviewScreen } from "./screens/ReviewScreen";

type Screen = "queue" | "detail" | "review" | "follow-up" | "metrics";

const navigation: Array<{ id: Screen; label: string }> = [
  { id: "queue", label: "Case queue" },
  { id: "detail", label: "Case detail" },
  { id: "review", label: "RM review" },
  { id: "follow-up", label: "Follow-up" },
  { id: "metrics", label: "Metrics" },
];

export function App() {
  const [screen, setScreen] = useState<Screen>("queue");
  const [caseId, setCaseId] = useState("CS-1041");

  function openCase(id: string) {
    setCaseId(id);
    setScreen("detail");
  }

  let content;
  switch (screen) {
    case "detail":
      content = <CaseDetailScreen caseId={caseId} onReview={(id) => { setCaseId(id); setScreen("review"); }} />;
      break;
    case "review":
      content = <ReviewScreen caseId={caseId} />;
      break;
    case "follow-up":
      content = <FollowUpScreen />;
      break;
    case "metrics":
      content = <MetricsScreen />;
      break;
    default:
      content = <CaseQueueScreen onOpenCase={openCase} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <a className="brand-lockup" href="#queue" onClick={(event) => { event.preventDefault(); setScreen("queue"); }}>
          <span className="brand-mark" aria-hidden="true">DC</span>
          <span className="brand-copy">
            <strong>Document Chaser</strong>
            <small>Onboarding Ops</small>
          </span>
          <span className="synthetic-label">Synthetic data</span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <button
              aria-current={screen === item.id ? "page" : undefined}
              className={screen === item.id ? "nav-link nav-link-active" : "nav-link"}
              key={item.id}
              onClick={() => setScreen(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-context">
          <span className="context-dot" />
          <span>Local prototype</span>
        </div>
      </header>
      <div className="app-content">{content}</div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((item) => (
          <button
            aria-current={screen === item.id ? "page" : undefined}
            className={screen === item.id ? "mobile-nav-link mobile-nav-active" : "mobile-nav-link"}
            key={item.id}
            onClick={() => setScreen(item.id)}
            type="button"
          >
            <span className="mobile-nav-dot" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
