"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h2>שגיאת מערכת</h2>
        <p style={{ opacity: 0.8, direction: "ltr" }}>{error?.message}</p>
        <button
          onClick={() => reset()}
          style={{ padding: "10px 14px", cursor: "pointer" }}
        >
          נסה שוב
        </button>
      </body>
    </html>
  );
}
