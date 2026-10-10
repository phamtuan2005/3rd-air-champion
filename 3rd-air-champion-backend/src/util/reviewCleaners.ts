import { findAssignments } from "./assignmentQuery";
import { cleaningWindow } from "./reviewStats";

// Who cleaned a review's room around its stay — the point of keeping reviews
// at all: a complaint leads to who prepared the room, a 5-star stay to who to
// thank. A LEAD, never proof: a review gives a night at best, often only a
// month, so each answer says which it was.
//
// Shared by TT's review answers in TiMag (GET /tt-host/reviews/stats) and the
// Guest reviews list (GET /tt-host/reviews/entries), so the two can never name
// different cleaners for one review (host, 2026-10-10: "show under each review
// who the cleaner was, like you did in Ask TT").

// The day cleaning visits began to be recorded (see the hours-provenance
// note). A stay before it has no cleaner on record, which is not the same as
// "nobody cleaned": the row says so rather than look like a gap.
export const ROTA_STARTS = "2026-07-20";

export type LeadBasis = "night" | "month" | "none" | "before";

export interface CleanerLead {
  cleaners: string[];
  // night = the stay's first night is known; month = only the review's month;
  // none = no date at all; before = the stay predates the rota.
  basis: LeadBasis;
}

export const cleanerLeads = async (
  hostId: string,
  rows: { room: string; stayDate?: string; reviewMonth?: string }[],
): Promise<CleanerLead[]> => {
  const windows = rows.map((r) => cleaningWindow({ stayDate: r.stayDate ?? "", reviewMonth: r.reviewMonth ?? "" }));
  // One read of the rota across the whole span, matched in memory.
  const spans = windows.filter((w): w is { start: string; end: string } => !!w && w.end >= ROTA_STARTS);
  let rota: any[] = [];
  if (spans.length) {
    const start = spans.reduce((a, w) => (w.start < a ? w.start : a), spans[0].start);
    const end = spans.reduce((a, w) => (w.end > a ? w.end : a), spans[0].end);
    rota = (await findAssignments({ host: hostId, start, end })) as any[];
  }
  return rows.map((r, i) => {
    const w = windows[i];
    if (!w) return { cleaners: [], basis: "none" };
    if (w.end < ROTA_STARTS) return { cleaners: [], basis: "before" };
    const inWindow = rota
      .filter((a) => String(a.room?._id ?? a.room) === String(r.room) && a.date >= w.start && a.date <= w.end)
      .filter((a) => a.cleaner?.name);
    if (r.stayDate) {
      // ONE cleaning prepares a room for a stay: the latest on or before the
      // night it starts. The window reaches back to the night before (a room
      // can be cleaned the day ahead), so it also caught the previous guest's
      // turnover — Han's Sep 29 stay read "prepared by Thalia, Henry" when
      // Thalia's Sep 28 clean was for the guest before (host, 2026-10-10:
      // "each room was assigned to a single cleaner"). Newest first, take one.
      const latest = [...inWindow].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      return { cleaners: latest ? [String(latest.cleaner.name)] : [], basis: "night" };
    }
    // Month only: everyone who cleaned the room that month — the line says so.
    return { cleaners: [...new Set(inWindow.map((a) => String(a.cleaner.name)))], basis: "month" };
  });
};
