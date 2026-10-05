import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { jwtDecode } from "jwt-decode";
import { getToken } from "../../util/authSession";
import { fetchGuests } from "../../util/guestOperations";
import { guestType } from "../../util/types/guestType";
import {
  fetchTiBookStatsGrants,
  grantTiBookStats,
  revokeTiBookStats,
  StatsGrant,
} from "../../util/tibookVisitOperations";

// How long the confirm button waits before it can be pressed. Long enough that
// a double-click on a guest's name cannot land on it as its second click; short
// enough that a host who means it never notices.
const ARM_MS = 700;

type Step =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "confirming"; guest: guestType }
  | { kind: "done"; name: string; code: string };

/*
 * Who besides the host may read these numbers.
 *
 * For a guest helping develop TiBook (2026-10-05), not a feature for guests in
 * general. What they get is the counts, trends and continents with every guest
 * identity removed BY THE SERVER (tibookStatsViewerRoute) — never the "Guests
 * who visited" list above.
 *
 * Giving it takes two separate clicks, on purpose: pick the guest, then confirm
 * on a card of its own that names them and says what they will see. A single
 * stray tap on a name in a list cannot hand the right to the wrong person, and
 * the confirm button does not arm for a moment, so a double-click cannot
 * either. The server refuses a request without the confirmation too.
 *
 * The right is a CODE, not a flag on the guest. TiBook knows a guest only by a
 * phone number anyone can type; the code is what proves it is them. It is
 * shown here once and only its hash is kept, so a lost code is replaced, not
 * looked up.
 */
const TiBookStatsAccess = () => {
  const [grants, setGrants] = useState<StatsGrant[] | null>(null);
  const [guests, setGuests] = useState<guestType[] | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadGrants = () =>
    fetchTiBookStatsGrants()
      .then(setGrants)
      .catch(() => setGrants([]));

  useEffect(() => {
    loadGrants();
    return () => clearTimeout(armTimer.current);
  }, []);

  // The guests are only fetched once the host starts to give access — most
  // visits to this screen are to read the numbers.
  const startPicking = () => {
    setError("");
    setQuery("");
    setStep({ kind: "picking" });
    if (guests) return;
    const token = getToken();
    let hostId = "";
    try {
      hostId = (jwtDecode(token ?? "") as { hostId?: string }).hostId ?? "";
    } catch {
      // Falls through to the error below.
    }
    fetchGuests(hostId, token ?? "")
      .then((list: guestType[]) => setGuests(list ?? []))
      .catch(() => setError("Your guests didn't load. Try again in a moment."));
  };

  // Click one: a guest. Nothing is given yet.
  const pick = (guest: guestType) => {
    setArmed(false);
    setStep({ kind: "confirming", guest });
    clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(true), ARM_MS);
  };

  // Click two: on the confirmation card, once it has armed.
  const confirm = async (guest: guestType) => {
    if (!armed || busy) return;
    setBusy(true);
    setError("");
    try {
      const { name, code } = await grantTiBookStats(guest.id);
      setStep({ kind: "done", name, code });
      setCopied(false);
      loadGrants();
    } catch {
      setError("That didn't go through. Nothing was given — try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (g: StatsGrant) => {
    try {
      await revokeTiBookStats(g.guestId);
      loadGrants();
    } catch {
      setError(`Couldn't take ${g.name}'s access away. Try again.`);
    }
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !guests) return [];
    return guests.filter((g) => `${g.name} ${g.alias ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [guests, query]);

  const first = (name: string) => name.trim().split(/\s+/)[0];
  const link = `${window.location.origin}/book?stats`;

  return (
    <section className="rounded-xl border border-gray-200 p-3">
      <h3 className="text-sm font-semibold text-gray-800">Who else can see these numbers</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
        For a guest helping to develop TiBook. They see the visitor counts, trends and continents
        — never a guest's name or number.
      </p>

      {grants && grants.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100">
          {grants.map((g) => (
            <li key={g.guestId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate text-gray-700">
                {g.name}
                <span className="ml-1.5 text-xs text-gray-400">
                  since {format(new Date(g.grantedAt), "MMM d")}
                  {g.grantedBy ? ` · by ${g.grantedBy}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revoke(g)}
                className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Take away
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      {step.kind === "idle" && (
        <button
          type="button"
          onClick={startPicking}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Give a guest access…
        </button>
      )}

      {step.kind === "picking" && (
        <div className="mt-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type the guest's name"
            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
          />
          {!guests && !error && <p className="mt-1 text-xs text-gray-400">Loading your guests…</p>}
          {matches.length > 0 && (
            <ul className="mt-1 divide-y divide-gray-100 rounded border border-gray-100">
              {matches.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => pick(g)}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="truncate text-gray-800">{g.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">Choose ›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {guests && query.trim() && matches.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">No guest by that name.</p>
          )}
          <button
            type="button"
            onClick={() => setStep({ kind: "idle" })}
            className="mt-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {step.kind === "confirming" && (
        // Its own card, not the row that was tapped: the second click has to
        // be a separate, deliberate one.
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-gray-900">
            Give {step.guest.name} access to TiBook's visitor numbers?
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-gray-600">
            <li>They'll see visitor counts, who comes back, and continents.</li>
            <li>They won't see any guest's name or phone number.</li>
            <li>You'll get a code to send them. You can take it away any time.</li>
          </ul>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep({ kind: "picking" })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!armed || busy}
              onClick={() => confirm(step.guest)}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:bg-black disabled:opacity-40"
            >
              {busy ? "Giving access…" : `Yes, give ${first(step.guest.name)} access`}
            </button>
          </div>
        </div>
      )}

      {step.kind === "done" && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-gray-900">{step.name} has access.</p>
          <p className="mt-1 text-xs text-gray-600">
            Send {first(step.name)} this code and the link. The code is shown only now — to change it,
            give access again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-white px-2.5 py-1.5 font-mono text-base font-bold tracking-wider text-gray-900 ring-1 ring-emerald-200">
              {step.code}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${link}\nCode: ${step.code}`).then(() => setCopied(true)).catch(() => {});
              }}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {copied ? "Copied ✓" : "Copy link & code"}
            </button>
          </div>
          <p className="mt-1.5 break-all text-xs text-gray-500">{link}</p>
          <button
            type="button"
            onClick={() => setStep({ kind: "idle" })}
            className="mt-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
          >
            Done
          </button>
        </div>
      )}
    </section>
  );
};

export default TiBookStatsAccess;
