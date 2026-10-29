"use client";

import Link from "next/link";

export function FacultyView() {
  return (
    <section className="qm-panel hub-panel faculty-panel" aria-labelledby="faculty-title">
      <div className="hub-panel-heading">
        <div className="hub-panel-copy">
          <h1 id="faculty-title">Faculty &amp; Instructor</h1>
          <p>
            Review generated drafts beside their cited PDF pages, manage materials, schedule activities and follow
            course performance in the faculty workspace.
          </p>
        </div>
      </div>

      <Link
        href="/faculty"
        data-tooltip="Open the faculty workspace for review, materials, activities and performance."
        className="drawer-instructor-card hub-faculty-card"
      >
        <div className="drawer-instructor-icon-box" aria-hidden="true">
          🎓
        </div>
        <div className="drawer-instructor-info">
          <div className="drawer-instructor-title-row">
            <strong>Faculty workspace</strong>
            <span className="drawer-arrow-pill">Open →</span>
          </div>
          <p className="drawer-instructor-desc">
            Dashboard, review queue with source citations, course materials, activity editor and student performance.
          </p>
        </div>
      </Link>

      <Link
        href="/instructor"
        data-tooltip="Open the legacy Instructor Studio for AI generation and Judge0 verification."
        className="drawer-instructor-card hub-faculty-card"
      >
        <div className="drawer-instructor-icon-box" aria-hidden="true">
          🛠
        </div>
        <div className="drawer-instructor-info">
          <div className="drawer-instructor-title-row">
            <strong>Instructor Studio</strong>
            <span className="drawer-arrow-pill">Open →</span>
          </div>
          <p className="drawer-instructor-desc">
            Upload lesson materials, generate AI coding challenges &amp; quizzes, and verify in Judge0.
          </p>
        </div>
      </Link>
    </section>
  );
}
