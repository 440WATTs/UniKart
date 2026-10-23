"use client";

/** Last-resort boundary for errors in the root layout. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf6eb", color: "#000" }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>UniKart is having trouble</h1>
          <p>Something went wrong while loading the page. Please try again in a moment.</p>
          {error.digest && <p style={{ fontSize: 12, color: "#5f5f5f" }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "10px 20px", border: "2px solid #000", background: "#ffe34d", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
