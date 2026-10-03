import { CostReportPage, fetchMonthSpend, summarizeSpend } from "../apiSpend";

// What the assistant has cost this month, read from Anthropic's cost report.
// The amounts are decimal strings in CENTS — "123.45" is $1.23 — which is the
// kind of unit that is read as dollars once and shows the host a bill a
// hundred times its size.

const page = (buckets: { date: string; amounts: string[] }[], next: string | null = null): CostReportPage => ({
  data: buckets.map((b) => ({
    starting_at: `${b.date}T00:00:00Z`,
    ending_at: `${b.date}T00:00:00Z`,
    results: b.amounts.map((amount) => ({ amount, currency: "USD" })),
  })),
  has_more: next !== null,
  next_page: next,
});

describe("summing the cost report", () => {
  it("reads cents, and answers in dollars to the cent", () => {
    // The documentation's own example: "123.45" in USD is $1.23.
    const spend = summarizeSpend([page([{ date: "2026-10-01", amounts: ["123.45"] }])], "2026-10-01", "2026-10-02");
    expect(spend.monthUsd).toBe(1.23);
    expect(spend.days).toEqual([{ date: "2026-10-01", usd: 1.23 }]);
  });

  it("adds every line of every day, and knows which is today", () => {
    const spend = summarizeSpend(
      [
        page([
          { date: "2026-10-01", amounts: ["100", "50.5"] },
          { date: "2026-10-02", amounts: [] }, // a day with no cost comes back empty
          { date: "2026-10-03", amounts: ["249.5"] },
        ]),
      ],
      "2026-10-01",
      "2026-10-03",
    );
    expect(spend.monthUsd).toBe(4.0);
    expect(spend.todayUsd).toBe(2.5);
    expect(spend.days.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-03"]);
  });

  it("is zero for a month with nothing in it", () => {
    const spend = summarizeSpend([page([])], "2026-10-01", "2026-10-02");
    expect(spend).toEqual({ month: "2026-10-01", monthUsd: 0, todayUsd: 0, days: [] });
  });
});

describe("asking Anthropic", () => {
  const now = new Date("2026-10-02T18:00:00Z");

  it("asks for the month in cents and follows every page", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const body = url.includes("page=")
        ? page([{ date: "2026-10-02", amounts: ["10"] }])
        : page([{ date: "2026-10-01", amounts: ["90"] }], "page_2");
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as unknown as typeof fetch;

    const spend = await fetchMonthSpend("sk-ant-admin01-test", now, fetchImpl);
    expect(spend.monthUsd).toBe(1.0);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("starting_at=2026-10-01T00%3A00%3A00.000Z");
    expect(calls[0]).toContain("ending_at=2026-11-01T00%3A00%3A00.000Z");
    expect(calls[1]).toContain("page=page_2");
  });

  // The one failure the host can fix himself is named as such.
  it("says when the key is not an admin key", async () => {
    const fetchImpl = (async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response) as unknown as typeof fetch;
    await expect(fetchMonthSpend("sk-ant-api03-wrong", now, fetchImpl)).rejects.toThrow(/Admin API key/);
  });
});
