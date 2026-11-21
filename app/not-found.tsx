import "./globals.css";

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main className="empty-state">
          <h1>Page not found</h1>
          <a className="button" href="/">
            Go home
          </a>
        </main>
      </body>
    </html>
  );
}
