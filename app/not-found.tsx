import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <span className="overline">404 · A SMALL DETOUR</span>
      <h1>This page hasn’t taken off.</h1>
      <Link href="/" className="button">
        Back to the beginning
      </Link>
    </main>
  );
}
