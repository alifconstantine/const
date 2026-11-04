const DAY = 86_400_000;
export const RATE_CACHE_MAX_AGE = 26 * 60 * 60_000;
// Daily reference observations can pause over weekends and public holidays.
export const RATE_OBSERVATION_MAX_AGE = 7 * DAY;

export function parseReferenceRate(data: unknown, now = Date.now()) {
  const value = data as {
    base?: unknown;
    quote?: unknown;
    date?: unknown;
    rate?: unknown;
  } | null;
  if (
    !value ||
    value.base !== "USD" ||
    value.quote !== "IDR" ||
    typeof value.rate !== "number" ||
    !Number.isFinite(value.rate) ||
    value.rate <= 0 ||
    value.rate > 1_000_000 ||
    typeof value.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
  )
    throw new Error("Invalid USD/IDR reference rate");
  const observedAt = Date.parse(`${value.date}T00:00:00Z`);
  if (
    !Number.isFinite(observedAt) ||
    new Date(observedAt).toISOString().slice(0, 10) !== value.date ||
    observedAt > now ||
    now - observedAt > RATE_OBSERVATION_MAX_AGE
  )
    throw new Error("Outdated USD/IDR reference rate");
  // Checkout uses whole rupiah, rounded up by less than Rp1 per USD.
  return { idrPerUsd: Math.ceil(value.rate), referenceDate: value.date };
}

export function usableReferenceRate(
  rate: { idrPerUsd: number; referenceDate: string; fetchedAt: number } | null,
  now = Date.now(),
) {
  if (
    !rate ||
    !Number.isFinite(rate.fetchedAt) ||
    rate.fetchedAt > now + 300_000 ||
    now - rate.fetchedAt > RATE_CACHE_MAX_AGE
  )
    return null;
  try {
    const parsed = parseReferenceRate(
      {
        base: "USD",
        quote: "IDR",
        date: rate.referenceDate,
        rate: rate.idrPerUsd,
      },
      now,
    );
    return Number.isSafeInteger(rate.idrPerUsd) ? parsed.idrPerUsd : null;
  } catch {
    return null;
  }
}
