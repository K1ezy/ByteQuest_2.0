import Link from "next/link";
import { FeaturedQuestWindow } from "@/components/featured-quest-window";
import { HomeRedirect } from "@/components/home-redirect";

export default function HomePage() {
  return (
    <div className="home-shell">
      <HomeRedirect />
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
        <FeaturedQuestWindow />
      </section>
      <section className="home-features" aria-label="Platform features">
        <article><span className="feature-number">01</span><h2>Built from your lessons</h2><p>Instructors turn course PDFs into reviewed coding challenges.</p></article>
        <article><span className="feature-number">02</span><h2>Practice without risk</h2><p>Try visible examples in a sandbox before making an official submission.</p></article>
        <article><span className="feature-number">03</span><h2>Progress you can see</h2><p>Earn experience, unlock milestones, and follow a steady learning path.</p></article>
      </section>
    </div>
  );
}
