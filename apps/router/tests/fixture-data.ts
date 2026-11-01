// Synthetic UI QA data only. These numbers never enter the production application.
import { DEFAULT_SETTINGS } from "@const/backend/router/preferences";
const now = Date.now();
export const quota = {
  weeklyLimitTokens: 7_000_000,
  usedTokens: 1_164_200,
  remainingTokens: 5_835_800,
  weeklyLimitImages: 20,
  usedImages: 3,
  remainingImages: 17,
  resetsInText: "4d 12h",
};
export const wallet = {
  balanceUsd: 14.30251,
  availableUsd: 14.28251,
  reservedUsd: 0.02,
  totalDepositedUsd: 20,
  totalSpentUsd: 5.69749,
  topUpAvailable: false,
};
export const transactions = [
  {
    _id: "fixture_tx1",
    type: "deduction",
    amountUsd: 0.000012,
    balanceAfterUsd: 14.30251,
    status: "completed",
    description: "gpt-6.1-sol usage",
    requestId: "req_fixture_01",
    createdAt: now - 120_000,
  },
  {
    _id: "fixture_tx2",
    type: "deduction",
    amountUsd: 0.04218,
    balanceAfterUsd: 14.302522,
    status: "completed",
    description: "claude-sonnet-5.5 usage",
    requestId: "req_fixture_02",
    createdAt: now - 3_600_000,
  },
  {
    _id: "fixture_tx3",
    type: "bonus",
    amountUsd: 20,
    balanceAfterUsd: 20,
    status: "completed",
    description: "Account credit adjustment",
    requestId: "fixture_adjustment_01",
    createdAt: now - 86400000,
  },
];
export const analytics = {
  kpi: {
    totalRequests: 1284,
    totalTokens: 2_483_120,
    freeTokens: 1_164_200,
    paidTokens: 1_318_920,
    legacyTokens: 0,
    costUsd: 0.873415,
    successRate: 99.4,
    avgDurationMs: 1680,
  },
  timeline: Array.from({ length: 168 }, (_, index) => {
    const requests = Math.round(2 + ((index * 17) % 15));
    return {
      timestamp: now - (167 - index) * 3_600_000,
      tokens: requests * (750 + ((index * 23) % 500)),
      requests,
      costUsd: requests * 0.00031,
    };
  }),
  modelBreakdown: [
    {
      model: "deepseek-v4.1-flash:free",
      tier: "free",
      requests: 826,
      tokens: 1_164_200,
      costUsd: 0,
    },
    {
      model: "gpt-6.1-sol",
      tier: "paid",
      requests: 327,
      tokens: 948_721,
      costUsd: 0.52782,
    },
    {
      model: "claude-sonnet-5.5",
      tier: "paid",
      requests: 131,
      tokens: 370_199,
      costUsd: 0.345595,
    },
  ],
  historicalCostsAvailable: false,
};
export const logs = [
  {
    _id: "fixture_log1",
    model: "deepseek-v4.1-flash:free",
    totalTokens: 4320,
    status: 200,
    createdAt: now - 120000,
    billingTier: "free",
  },
  {
    _id: "fixture_log2",
    model: "gpt-6.1-sol",
    totalTokens: 1894,
    status: 200,
    createdAt: now - 240000,
    billingTier: "paid",
  },
  {
    _id: "fixture_log3",
    model: "claude-sonnet-5.5",
    totalTokens: 0,
    status: 502,
    createdAt: now - 360000,
    billingTier: "paid",
  },
];
export const settings = { ...DEFAULT_SETTINGS };
