import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> YOUR NEXT LEVEL STARTS HERE</p>
          <h1>Learn to code.<br /><span>One quest at a time.</span></h1>
          <p className="hero-description">
            Build real programming skills with challenges shaped around your course material,
            safe code execution, and progress that keeps moving.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/onboarding">Start your journey <span aria-hidden="true">→</span></Link>
            <Link className="button button-quiet" href="/quests">Explore quests</Link>
          </div>
          <p className="hero-note">A focused workspace for students and the instructors who guide them.</p>
        </div>
        <div className="quest-preview" aria-label="Example quest preview">
          <div className="preview-topline"><span className="preview-badge">QUEST 01</span><span className="preview-xp">✦ 50 XP</span></div>
          <div className="preview-icon" aria-hidden="true">&lt;/&gt;</div>
          <p className="preview-kicker">PYTHON · FOUNDATIONS</p>
          <h2>Make the loop count</h2>
          <p className="preview-copy">Use repetition to solve a small problem. Run your sample, then send it for grading.</p>
          <div className="preview-progress"><span /><span /><span /><span className="muted" /><span className="muted" /></div>
          <div className="preview-footer"><span>YOUR LEARNING PATH</span><span>01 / 05</span></div>
        </div>
      </section>
      <section className="home-features" aria-label="Platform features">
        <article><span className="feature-number">01</span><h2>Built from your lessons</h2><p>Instructors turn course PDFs into reviewed coding challenges.</p></article>
        <article><span className="feature-number">02</span><h2>Practice without risk</h2><p>Try visible examples in a sandbox before making an official submission.</p></article>
        <article><span className="feature-number">03</span><h2>Progress you can see</h2><p>Earn experience, unlock milestones, and follow a steady learning path.</p></article>
      </section>
    </div>
  );
}
