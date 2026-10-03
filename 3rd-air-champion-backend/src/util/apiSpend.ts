// What the assistant has cost, from Anthropic's cost report.
//
// Anh-Tuan asked "Can I also know API remaining credit?" The balance itself is
// shown only in the Anthropic Console; what the API gives is the spend, by day,
// through the Admin API's cost report. This reads that for the current month.
//
// Needs an ADMIN key (sk-ant-admin01-…), separate from the key TT answers with:
// the ordinary key cannot read the organization's costs. It lives in the EC2
// .env as ANTHROPIC_ADMIN_KEY, like the other one, and nowhere else.
//
// Amounts arrive as decimal strings in CENTS ("123.45" is $1.23), per the
// docs. Summed as numbers here and returned in dollars, rounded to the cent,
// which is the precision the Console shows and the one the host thinks in.

export interface CostReportPage {
  data: { starting_at: string; ending_at: string; results: { amount: string; currency: string }[] }[];
  has_more: boolean;
  next_page: string | null;
}

export interface Spend {
  // The month covered, as its first day, yyyy-MM-dd.
  month: string;
  // Dollars spent since the first of the month, to the cent.
  monthUsd: number;
  // Dollars spent today (UTC day, which is how Anthropic buckets it).
  todayUsd: number;
  // Each day with a cost, oldest first.
  days: { date: string; usd: number }[];
}

const cents = (amount: string): number => {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
};

const toUsd = (c: number): number => Math.round(c) / 100;

/** The month's spend from the report's pages, for a month beginning on `month`. */
export const summarizeSpend = (pages: CostReportPage[], month: string, todayKey: string): Spend => {
  const byDay = new Map<string, number>();
  for (const page of pages)
    for (const bucket of page.data ?? []) {
      const date = String(bucket.starting_at).slice(0, 10);
      const sum = (bucket.results ?? []).reduce((n, r) => n + cents(r.amount), 0);
      if (sum > 0) byDay.set(date, (byDay.get(date) ?? 0) + sum);
    }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    month,
    monthUsd: toUsd(days.reduce((n, [, c]) => n + c, 0)),
    todayUsd: toUsd(byDay.get(todayKey) ?? 0),
    days: days.map(([date, c]) => ({ date, usd: toUsd(c) })),
  };
};

const COST_REPORT = "https://api.anthropic.com/v1/organizations/cost_report";

/**
 * This month's spend from Anthropic, every page of it.
 *
 * `fetchImpl` is injectable so the route is testable without the network; the
 * default is the platform fetch.
 */
export const fetchMonthSpend = async (
  adminKey: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<Spend> => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const next = new Date(Date.UTC(y, m + 1, 1));
  const month = first.toISOString().slice(0, 10);

  const pages: CostReportPage[] = [];
  let page: string | null = null;
  for (let guard = 0; guard < 5; guard++) {
    const params = new URLSearchParams({
      starting_at: first.toISOString(),
      ending_at: next.toISOString(),
      bucket_width: "1d",
      limit: "31",
    });
    if (page) params.set("page", page);
    const res = await fetchImpl(`${COST_REPORT}?${params}`, {
      headers: {
        "x-api-key": adminKey,
        "anthropic-version": "2023-06-01",
        "User-Agent": "TiMag/1.0 (TT House)",
      },
    });
    if (!res.ok) {
      // 401 is the one the host can act on: the key is wrong or not an admin
      // key. Everything else is Anthropic's day, not his.
      throw new Error(
        res.status === 401
          ? "Anthropic will not show the spend to this key. It needs an Admin API key (sk-ant-admin01-…) as ANTHROPIC_ADMIN_KEY, which the Console offers once an organization is set up."
          : `Anthropic's cost report is unavailable (${res.status}).`,
      );
    }
    const body = (await res.json()) as CostReportPage;
    pages.push(body);
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return summarizeSpend(pages, month, now.toISOString().slice(0, 10));
};
