import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CreditsView } from "../src/app/(dashboard)/credits/page";
import { ModelCatalog } from "../src/app/(dashboard)/models/page";
function Preview() {
  const [view, setView] = useState(
    location.hash === "#models" ? "models" : "credits",
  );
  return (
    <>
      <nav className="mb-6 flex gap-4 text-sm">
        <button onClick={() => setView("credits")}>Credits fixture</button>
        <button onClick={() => setView("models")}>Models fixture</button>
      </nav>
      {view === "models" ? (
        <ModelCatalog />
      ) : (
        <CreditsView
          wallet={{
            balanceUsd: 14.30251,
            availableUsd: 14.28251,
            reservedUsd: 0.02,
            totalDepositedUsd: 20,
            totalSpentUsd: 5.69749,
          }}
          transactions={[
            {
              _id: "sample",
              type: "deduction",
              amountUsd: 0.00001234,
              balanceAfterUsd: 14.30251,
              status: "completed",
              description: "gpt-6.1-sol usage",
              requestId: "req_sample",
              createdAt: Date.UTC(2026, 9, 25, 0),
            },
          ]}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
