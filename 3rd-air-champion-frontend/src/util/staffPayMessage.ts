import { format } from "date-fns";
import { cleanerSignoff } from "./cleanerMessage";
import { formatHrMin } from "./hoursFormat";
import type { HostWorkEntry } from "./staffOperations";

// The text a staff member gets with their pay: the month's approved days,
// each at the rate it was approved at, what they add up to, and what was
// paid today with any tip named inside it — one happy number, the way the
// cleaner's summary reads (CleanersModal.textPayment). Asked for on
// 2026-09-30, when recording staff pay moved to the Payroll tab.
//
// Pure, so the wording is pinned by a test: it goes to a person's phone.

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "Mon 9/14" from a yyyy-MM-dd key. Built from the parts, never parsed as
// ISO, so the day cannot shift with the phone's timezone.
const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEE M/d");
};

export const staffPayMessage = (opts: {
  name: string;
  staffId: string;
  entries: HostWorkEntry[];
  monthKey: string; // yyyy-MM the payout is for
  monthName: string; // "September"
  paid: number;
  tip: number;
  sender?: string;
}): string => {
  const days = opts.entries
    .filter((w) => w.staffId === opts.staffId && w.status === "approved" && w.date.slice(0, 7) === opts.monthKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lines = days.map(
    (w) => `* ${dayLabel(w.date)}: ${formatHrMin(w.hours)} = $${money(w.hours * (w.approvedRate || 0))}`,
  );
  const subtotal = days.reduce((s, w) => s + w.hours * (w.approvedRate || 0), 0);
  const totalHrs = days.reduce((s, w) => s + w.hours, 0);
  return [
    `Hi ${opts.name}, here's your pay summary:`,
    ...(lines.length
      ? ["", `Your work in ${opts.monthName} — ${formatHrMin(totalHrs)} = $${money(subtotal)} gross:`, ...lines]
      : []),
    "",
    `Paid today: $${money(opts.paid + opts.tip)}${opts.tip > 0 ? ` (includes a $${money(opts.tip)} tip 🎁)` : ""}`,
    "",
    cleanerSignoff(opts.sender),
  ].join("\n");
};
