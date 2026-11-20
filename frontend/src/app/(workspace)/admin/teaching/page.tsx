import Link from "next/link";

export default function AdministratorTeachingPage() {
  return <section className="page-shell">
    <h1>Instructor Workspace</h1>
    <p>Open teaching tools available to your Administrator account.</p>
    <div className="ws-inline-actions">
      <Link className="button button-outline" href="/admin/teaching/preview">Student Preview</Link>
      <Link className="button button-outline" href="/workshops">Workshop Builder</Link>
      <Link className="button button-outline" href="/admin/teaching/exams">Exams</Link>
      <Link className="button button-outline" href="/admin/teaching/studio">Authoring Studio</Link>
    </div>
  </section>;
}
