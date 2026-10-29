"use client";

interface ActivityHubViewProps {
  currentCategory: string | null;
  onSelectCategory: (category: string) => void;
}

export function ActivityHubView({
  currentCategory,
  onSelectCategory,
}: ActivityHubViewProps) {
  return (
    <section
      className="qm-panel hub-panel activity-hub-panel"
      aria-labelledby="activity-hub-title"
    >
      <div className="hub-panel-heading">
        <div className="hub-panel-copy">
          <h1 id="activity-hub-title">Activity Hub</h1>
          <p>Choose a code challenge or a lessons review to continue learning.</p>
        </div>
      </div>

      <div className="drawer-module-cards hub-module-cards">
        <button
          type="button"
          onClick={() => onSelectCategory("code-challenge")}
          data-tooltip="Practice coding problems with automated tests."
          className={`drawer-module-card ${
            currentCategory === "code-challenge" ? "is-selected" : ""
          }`}
        >
          <span className="module-card-icon code-icon" aria-hidden="true">
            &lt;/&gt;
          </span>
          <div className="module-card-text">
            <p className="module-card-heading">Code Challenge</p>
            <p className="module-card-desc">
              Practice hands-on programming problems and automated test suites.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectCategory("lessons-review")}
          data-tooltip="Review concepts and take short quizzes."
          className={`drawer-module-card ${
            currentCategory === "lessons-review" ? "is-selected" : ""
          }`}
        >
          <span className="module-card-icon review-icon" aria-hidden="true">
            ✓
          </span>
          <div className="module-card-text">
            <p className="module-card-heading">Lessons Review</p>
            <p className="module-card-desc">
              Review core concepts, syntax summaries, and interactive concept checks.
            </p>
          </div>
        </button>
      </div>

      <div className="hub-show-all-row">
        <button
          type="button"
          onClick={() => onSelectCategory("")}
          className="drawer-show-all-btn"
        >
          Show All Quests
        </button>
      </div>
    </section>
  );
}
