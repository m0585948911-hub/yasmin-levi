"use client";

import React from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>משהו השתבש</h2>
      <p style={{ opacity: 0.8, direction: "ltr" }}>{error?.message}</p>
      <button
        onClick={() => reset()}
        style={{ padding: "10px 14px", cursor: "pointer" }}
      >
        נסה שוב
      </button>
    </div>
  );
}
