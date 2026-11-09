"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", textAlign: "center" }}>
          <div>
            <h1>Something went wrong</h1>
            <p>We recorded the error. You can try loading the page again.</p>
            <button onClick={() => reset()}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
