import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="ByteQuest home">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span>ByteQuest<span className="brand-period">.</span></span>
      </Link>
      <nav aria-label="Main navigation" className="main-nav">
        <Link href="/quests">Quest map</Link>
        <Link href="/instructor">Instructor studio</Link>
        <Link className="nav-cta" href="/onboarding">Get started</Link>
      </nav>
    </header>
  );
}
