import { useEffect, useMemo, useRef, useState } from "react";
import { dayType } from "../../../util/types/dayType";
import { bookingType, feesTotal } from "../../../util/types/bookingType";
import { addDays, differenceInCalendarDays, startOfToday, format } from "date-fns";
import { getRoomColor } from "../../../util/getRoomColor";
import { DEFAULT_TEMPLATE, TEMPLATE_KEY, resolveTemplate } from "../../../util/reminderTemplate";
import { CLEANING_LOOKBACK_DAYS, cleaningTaskId, getCleaningCounts, getCleaningItems, countPendingReminders, CleaningItem } from "../../../util/cleaningTasks";
import { fetchAssignments, CleaningAssignmentType, CleanerType } from "../../../util/cleanerOperations";
import CleanerAvatar from "../../shared/CleanerAvatar";
import { cleanerSignoff } from "../../../util/cleanerMessage";
import { fetchSentReminders, markReminderSent, unmarkReminderSent } from "../../../util/reminderOperations";

interface ToDoListProps {
  monthMap: Map<string, dayType>;
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  houseRules?: string;
  hostId?: string;
  token?: string | null;
  senderName?: string; // who's logged in — signs the cleaner text
}

type TabKey = "reminders" | "cleaning" | "payments";

const ToDoList = ({ monthMap, doorCode, airbnbName, airbnbAddress, houseRules = "", hostId, token, senderName }: ToDoListProps) => {
  // Reminders / Cleaning = today's actionable tasks.
  const [activeTab, setActiveTab] = useState<TabKey>("reminders");



  // Every To Do tick — reminders AND cleanings — for the ACCOUNT rather than
  // this browser. Cindy needs to see that Anh-Tuan already texted a guest or
  // cleaned a room; the old localStorage tick was invisible to her, so both of
  // them saw outstanding work that was already done.
  //
  // Reminder ids and cleaning ids share this record but can never collide:
  // cleanings are "clean-<date>-<room>", reminders are
  // "<start>-<end>-<guest>-<room>".
  const [sentReminders, setSentReminders] = useState<
    Record<string, { sentBy: string; sentAt: string }>
  >({});

  // Refetch whenever the app comes back to the foreground.
  //
  // MobilePanel never unmounts its children, so a mount-only fetch runs once
  // for the life of the page: reopening the panel would show whatever was true
  // when TiMag was first loaded. Cindy ticks something, Anh-Tuan picks up his
  // phone, and without this he sees stale state until a full reload — which
  // defeats the point of sharing the record at all.
  useEffect(() => {
    if (!hostId || !token) return;
    let live = true;
    const load = () =>
      fetchSentReminders(hostId, token)
        .then((rows) => { if (live) setSentReminders(Object.fromEntries(rows.map((r) => [r.taskId, { sentBy: r.sentBy, sentAt: r.sentAt }]))); })
        .catch(() => {});
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [hostId, token]);

  // Optimistic, but reverted if the server refuses — a tick that only exists on
  // one screen is the exact problem this replaces.
  const setReminderSent = async (taskId: string, sent: boolean) => {
    const previous = sentReminders;
    setSentReminders((prev) => {
      const next = { ...prev };
      if (sent) next[taskId] = { sentBy: senderName ?? "", sentAt: new Date().toISOString() };
      else delete next[taskId];
      return next;
    });
    if (!hostId || !token) return;
    try {
      if (sent) await markReminderSent({ host: hostId, taskId, sentBy: senderName ?? "" }, token);
      else await unmarkReminderSent({ host: hostId, taskId }, token);
    } catch {
      setSentReminders(previous);
    }
  };

  // Cleaning items expect the completed-task shape; the shared record is the
  // source of truth now, so derive it rather than keeping a second copy.
  const doneAsCompleted = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(sentReminders).map(([id, r]) => [
          id,
          { completed: true, date: r.sentAt ? format(new Date(r.sentAt), "MMM d, yyyy") : null },
        ]),
      ),
    [sentReminders],
  );
  const tomorrowKey = addDays(startOfToday(), 1).toISOString().split("T")[0];

  // Guests checking in tomorrow who get a reminder SMS (AirBnB guests are
  // reminded through the platform instead).
  const reminderBookings = useMemo(() => {
    const day = monthMap.get(tomorrowKey);
    if (!day || day.date.toString().split("T")[0] !== tomorrowKey) return [];
    return day.bookings.filter(
      (booking) =>
        booking.room != null &&
        booking.guest.name !== "AirBnB" &&
        booking.startDate === tomorrowKey,
    );
  }, [monthMap, tomorrowKey]);

  // Roll a stay forward across rooms: a guest thinks of consecutive nights in
  // different rooms as ONE booking, so the reminder should cover this night plus
  // every following night the same guest continues (into another room). Sending
  // from the arriving booking covers the whole remaining stay; miss it and the
  // next night's reminder still covers what's left.
  const buildStayChain = (first: bookingType): bookingType[] => {
    const chain: bookingType[] = [first];
    let current = first;
    for (let i = 0; i < 30; i++) {
      const lastNight = current.endDate.split("T")[0];
      const nextKey = format(addDays(new Date(lastNight + "T00:00:00"), 1), "yyyy-MM-dd");
      const next = monthMap
        .get(nextKey)
        ?.bookings.find(
          (b) =>
            b.room != null &&
            !b.reserved &&
            b.guest?.id === current.guest.id &&
            b.startDate.split("T")[0] === nextKey,
        );
      if (!next) break;
      chain.push(next);
      current = next;
    }
    return chain;
  };

  // All rooms needing cleaning: today's checkouts + rooms vacated earlier that were
  // never marked cleaned (the old logic assumed an empty room was never occupied).
  const cleaningItems = useMemo(
    () => getCleaningItems(monthMap, doneAsCompleted),
    [monthMap, doneAsCompleted],
  );
  const cleaningCounts = getCleaningCounts(cleaningItems);

  // Held stays whose promised pay date has passed. One row per STAY: a stay is
  // written onto every night it covers, so rows are taken from the START night
  // only — counting every row would report a 3-night hold as three chases.
  const overdueHolds = useMemo(() => {
    const todayKey = format(startOfToday(), "yyyy-MM-dd");
    const out: { booking: bookingType; daysLate: number }[] = [];
    monthMap.forEach((day, dayKey) => {
      day.bookings.forEach((b) => {
        if (!b.reserved || !b.room || !b.expectedPayDate) return;
        if (b.startDate.split("T")[0] !== dayKey) return;
        // Plain string comparison — both sides are zero-padded yyyy-MM-dd, so
        // this cannot drift a day the way a parsed local date can.
        if (b.expectedPayDate >= todayKey) return;
        out.push({
          booking: b,
          daysLate: differenceInCalendarDays(
            new Date(todayKey + "T00:00:00"),
            new Date(b.expectedPayDate + "T00:00:00"),
          ),
        });
      });
    });
    return out.sort((a, z) => z.daysLate - a.daysLate);
  }, [monthMap]);

  // Who's assigned to clean each dirty room. Assignments are keyed by the
  // cleaning morning (= the checkout morning) + room, so we fetch over the same
  // lookback the cleaning list uses and match on that key. Overdue rooms still
  // resolve their cleaner this way.
  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  useEffect(() => {
    if (!hostId || !token) return;
    const today = startOfToday();
    const start = format(addDays(today, -CLEANING_LOOKBACK_DAYS), "yyyy-MM-dd");
    const end = format(today, "yyyy-MM-dd");
    fetchAssignments(hostId, start, end, token)
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [hostId, token, monthMap]);

  const cleanerFor = (item: CleaningItem): CleanerType | null => {
    const roomId = item.booking.room?.id;
    if (!roomId) return null;
    const morningKey = format(addDays(new Date(item.checkoutKey + "T00:00:00"), 1), "yyyy-MM-dd");
    return assignments.find((a) => a.date === morningKey && a.room?.id === roomId)?.cleaner ?? null;
  };

  // Typical guest count per room, from the FULL booking history (the loaded
  // calendar = the DB's Day records). Used to fill the cleaner's "for N guests"
  // when a room has no upcoming guest yet, so a line is never a bare room name.
  // Each stay counted once (by check-in date + room). Falls back per-room →
  // overall average → 2 (a sensible default) so we ALWAYS give a number.
  const roomAvgGuests = useMemo(() => {
    const acc = new Map<string, { total: number; count: number; seen: Set<string> }>();
    let grandTotal = 0;
    let grandCount = 0;
    monthMap.forEach((day) => {
      day.bookings.forEach((b) => {
        const roomId = b.room?.id;
        if (!roomId) return;
        const stayKey = `${String(b.startDate).slice(0, 10)}|${roomId}`;
        let e = acc.get(roomId);
        if (!e) {
          e = { total: 0, count: 0, seen: new Set() };
          acc.set(roomId, e);
        }
        if (e.seen.has(stayKey)) return;
        e.seen.add(stayKey);
        const g = b.numberOfGuests ?? 1;
        e.total += g;
        e.count += 1;
        grandTotal += g;
        grandCount += 1;
      });
    });
    const perRoom = new Map<string, number>();
    acc.forEach((e, id) => {
      if (e.count > 0) perRoom.set(id, Math.max(1, Math.round(e.total / e.count)));
    });
    const overall = grandCount > 0 ? Math.max(1, Math.round(grandTotal / grandCount)) : 2;
    const guestsFor = (roomId?: string) =>
      (roomId ? perRoom.get(roomId) : undefined) ?? overall;
    return { guestsFor };
  }, [monthMap]);

  // Tapping a cleaner's name/avatar texts them their rooms to clean today — only
  // what THEY need: which room and for how many guests. The next guest's check-in
  // date is the owner's private info and is deliberately NOT included; the list is
  // still in priority order (urgent first), just without revealing why.
  const textCleanerSummary = (cleaner: CleanerType) => {
    if (!cleaner.phone) return;
    const first = cleaner.name.split(" ")[0];
    const mine = cleaningItems.filter(
      (it) => !it.isCompleted && cleanerFor(it)?.id === cleaner.id,
    );
    const dayLabel = format(startOfToday(), "EEE, MMM d");

    let body: string;
    if (mine.length === 0) {
      body =
        `Hi ${first}! Looks like all your rooms for today (${dayLabel}) are done.\n\n` +
        cleanerSignoff(senderName);
    } else {
      const lines = mine.map((it, i) => {
        const room = it.booking.room?.name ?? "Room";
        // Exact count from the incoming guest when known; otherwise the room's
        // typical occupancy from history — so the cleaner ALWAYS knows how many.
        const n = it.nextCheckIn?.numberOfGuests ?? roomAvgGuests.guestsFor(it.booking.room?.id);
        return `${i + 1}. ${room} — for ${n} guest${n === 1 ? "" : "s"}`;
      });
      body =
        `Hi ${first}! Cleaning for today (${dayLabel}) — ${mine.length} room${mine.length === 1 ? "" : "s"}, in suggested order:\n` +
        lines.join("\n") +
        `\n\n${cleanerSignoff(senderName)}`;
    }
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(body)}`;
  };


  // Once data arrives, open on the first tab that has work (Reminders →
  // Cleaning). Runs once; never overrides a tab the user tapped.
  const autoTabDone = useRef(false);
  useEffect(() => {
    if (autoTabDone.current || monthMap.size === 0) return;
    autoTabDone.current = true;
    if (reminderBookings.length === 0 && cleaningItems.length > 0) setActiveTab("cleaning");
  }, [monthMap, reminderBookings, cleaningItems]);


  const generateTaskId = (
    startDate: string,
    endDate: string,
    guestId: string,
    roomId: string,
  ) => `${startDate}-${endDate}-${guestId}-${roomId}`;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    // Reminders STILL TO SEND, not everyone arriving — matching the Cleaning tab
    // beside it, which has always counted only what's outstanding.
    {
      key: "reminders",
      label: "Reminders",
      // Counted from the shared record, so the badge agrees with the ticks —
      // countPendingReminders takes the completed-task shape, so adapt.
      count: countPendingReminders(
        monthMap,
        tomorrowKey,
        Object.fromEntries(
          Object.keys(sentReminders).map((id) => [id, { completed: true, date: null }]),
        ),
      ),
    },
    { key: "cleaning", label: "Cleaning", count: cleaningCounts.max },
    // Money promised and not arrived. Its own tab because it is chased at a
    // different moment from a reminder or a clean — and because a hold nobody
    // looks at is a room quietly not earning.
    { key: "payments", label: "Payments", count: overdueHolds.length },
  ];

  const emptyState = (message: string) => (
    <div className="flex flex-1 items-center justify-center py-10 text-base text-gray-400">
      {message}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 pb-3">
      <div className="pb-2 pt-3 text-center">
        <h1 className="text-lg font-bold tracking-tight text-gray-900">To Do</h1>
        <p className="text-sm text-gray-400">{format(startOfToday(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="mb-3 grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
              activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[12px] font-bold leading-none ${
                  activeTab === key ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "reminders" &&
        (reminderBookings.length > 0 ? (
          <>
            <p className="mb-1.5 text-center text-sm text-gray-400">
              Guests checking in tomorrow ({format(addDays(startOfToday(), 1), "MMM d")})
            </p>
            {reminderBookings.map((booking, index) => {
              const taskId = generateTaskId(
                booking.startDate,
                booking.endDate,
                booking.guest.id,
                booking.room.id,
              );
              const sent = sentReminders[taskId];
              const isCompleted = !!sent;

              return (
                <div
                  key={`reminder-${index}`}
                  className={`mb-1.5 flex items-center gap-2 rounded-xl border border-gray-200 p-2.5 ${
                    isCompleted ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-black"
                    checked={isCompleted}
                    onChange={() => setReminderSent(taskId, !isCompleted)}
                  />
                  {/* Seeded from the DISPLAYED name, so an AirBnB stay gets the
                       real guest's initials from their alias rather than a
                       meaningless "A". Every row then has one, which keeps the
                       text aligned — a column of avatars with gaps in it reads
                       as though the gaps mean something. */}
                  <CleanerAvatar
                    name={booking.guest.alias || booking.alias || booking.guest.name}
                    character={booking.guest.character}
                    sizeClass="h-9 w-9"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-base font-semibold ${
                        isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                      }`}
                    >
                      {booking.guest.alias || booking.alias || booking.guest.name}
                    </p>
                    <span
                      className={`${getRoomColor(booking.room.name, booking.room.color)} mt-0.5 inline-block rounded-md px-2 py-0.5 text-sm font-bold text-black`}
                    >
                      {booking.room.name}
                    </span>
                    {isCompleted && (
                      <p className="mt-0.5 text-sm text-gray-400">
                        Sent{sent?.sentBy ? ` by ${sent.sentBy}` : ""}
                        {sent?.sentAt ? ` on ${format(new Date(sent.sentAt), "MMM d")}` : ""}
                      </p>
                    )}
                  </div>
                  {!booking.description ? (
                    <button
                      className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                      onClick={() => {
                        const phone = booking.guest.phone;
                        const startDate = format(addDays(startOfToday(), 1), "MMMM do");
                        const currentTemplate = localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
                        const message = resolveTemplate(currentTemplate, buildStayChain(booking), startDate, doorCode, airbnbName, airbnbAddress, houseRules);
                        window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
                        setReminderSent(taskId, true);
                      }}
                      disabled={isCompleted}
                    >
                      Send Reminder
                    </button>
                  ) : (
                    <button
                      className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                      onClick={() => {
                        const url = booking.description.match(
                          /https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/\S+/,
                        )?.[0];
                        if (url) {
                          window.open(url, "_blank", "noopener,noreferrer");
                        } else {
                          alert("No valid URL found in the description.");
                        }
                      }}
                      disabled={isCompleted}
                    >
                      Booking Details
                    </button>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          emptyState("No check-ins tomorrow")
        ))}

      {activeTab === "payments" &&
        (overdueHolds.length > 0 ? (
          <div className="flex flex-col gap-2">
            {overdueHolds.map(({ booking, daysLate }) => (
              <div
                key={`${booking.startDate.split("T")[0]}|${booking.room.id}`}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900">
                      {booking.guest.alias || booking.alias || booking.guest.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`${getRoomColor(booking.room.name, booking.room.color)} rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                      >
                        {booking.room.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {format(new Date(booking.startDate.split("T")[0] + "T00:00:00"), "MMM d")} ·{" "}
                        {booking.duration} night{booking.duration === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold tabular-nums text-gray-900">
                      ${Math.round((booking.price ?? 0) * booking.duration + feesTotal(booking.fees))}
                    </p>
                    <p className="text-xs font-bold text-red-600">
                      {daysLate} day{daysLate === 1 ? "" : "s"} late
                    </p>
                  </div>
                </div>
                {/* Their own words, dated. Chasing goes better when the date
                    came from the guest rather than from the house. */}
                <p className="mt-1.5 text-xs text-red-700">
                  Promised{" "}
                  {format(
                    new Date(booking.expectedPayDate + "T00:00:00"),
                    "EEEE, MMM d",
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          emptyState("No payments overdue")
        ))}

      {activeTab === "cleaning" &&
        (cleaningItems.length > 0 ? (
          <>
            {cleaningCounts.min !== cleaningCounts.max && (
              <p className="mb-1.5 text-center text-sm text-gray-400">
                min {cleaningCounts.min} before today&apos;s check-ins · max {cleaningCounts.max} total
              </p>
            )}
            {cleaningItems.map((item, index) => {
              const { booking, nextCheckIn, nextCheckInDate } = item;
              const taskId = cleaningTaskId(booking.endDate, booking.room?.id ?? "");
              const isCompleted = item.isCompleted;
              const cleaner = cleanerFor(item);

              return (
                <div
                  key={`clean-${index}`}
                  className={`mb-1.5 flex items-start gap-2.5 rounded-xl border border-gray-200 p-2.5 ${
                    isCompleted ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-black"
                    checked={isCompleted}
                    onChange={() => setReminderSent(taskId, !isCompleted)}
                  />
                  {/* Cleaner avatar — same treatment as the Cleaning modal, and
                      tappable: it texts them today's full cleaning list. An
                      unassigned room shows the amber "!" marker instead. */}
                  {cleaner ? (
                    <button
                      type="button"
                      onClick={() => textCleanerSummary(cleaner)}
                      disabled={!cleaner.phone}
                      title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} today's cleaning list` : cleaner.name}
                      className="shrink-0 rounded-full disabled:cursor-default"
                    >
                      <CleanerAvatar
                        name={cleaner.name}
                        photo={cleaner.photo}
                        character={cleaner.character}
                        sizeClass="h-9 w-9"
                      />
                    </button>
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base font-bold text-amber-600">
                      !
                    </span>
                  )}
                  <div
                    className={`flex min-w-0 flex-1 flex-col gap-0.5 ${
                      isCompleted ? "text-gray-400 line-through" : ""
                    }`}
                  >
                    {/* Cleaner name — tap it (or the avatar) to text them today's
                        cleaning list. */}
                    {cleaner ? (
                      <button
                        type="button"
                        onClick={() => textCleanerSummary(cleaner)}
                        disabled={!cleaner.phone}
                        title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} today's cleaning list` : cleaner.name}
                        className="w-fit text-left no-underline disabled:cursor-default"
                      >
                        <span className="text-base font-bold text-gray-900 hover:underline">
                          {cleaner.name}
                        </span>
                      </button>
                    ) : (
                      <span className="text-base font-bold text-amber-600">Unassigned</span>
                    )}
                    {/* Room + who's arriving into it */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`${getRoomColor(booking.room.name, booking.room.color)} rounded-md px-2 py-0.5 text-sm font-bold ${
                          nextCheckIn?.guest.name === "AirBnB" ? "text-white" : "text-black"
                        }`}
                      >
                        {booking.room.name}
                      </span>
                      {nextCheckIn ? (
                        <span className="text-sm text-gray-600">
                          <span className="font-semibold text-gray-800">
                            {nextCheckIn.guest.alias || nextCheckIn.alias || nextCheckIn.guest.name}
                          </span>{" "}
                          · {nextCheckIn.numberOfGuests}{" "}
                          {nextCheckIn.numberOfGuests === 1 ? "guest" : "guests"}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No upcoming check-in</span>
                      )}
                    </div>
                    {/* Arrival timing / urgency */}
                    {nextCheckIn && nextCheckInDate && (
                      <p
                        className={`text-sm ${
                          item.mustCleanToday ? "font-semibold text-red-500" : "text-gray-500"
                        }`}
                      >
                        {item.mustCleanToday
                          ? "Checking in TODAY"
                          : `Arrives ${format(new Date(nextCheckInDate + "T00:00:00"), "EEE M/d")}`}
                      </p>
                    )}
                    {/* Scenario: turnover this morning vs sitting empty since an earlier checkout */}
                    {item.vacatedToday ? (
                      <p className="text-sm text-gray-500">Checked out this morning</p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-600">
                        Empty since {format(addDays(new Date(item.checkoutKey + "T00:00:00"), 1), "MM/dd")} — not cleaned yet
                      </p>
                    )}
                    {nextCheckIn?.earlyCheckin && (
                      <p className="text-sm font-semibold text-orange-500">
                        Early Check-in Requested
                      </p>
                    )}
                    {/* Off the ARRIVING stay, like the headcount above — the
                        sofa bed is for the people coming in. The one request
                        here that adds work to the clean rather than moving a
                        time, so it is said rather than inferred from "3 guests". */}
                    {nextCheckIn?.sofaBed && (
                      <p className="text-sm font-semibold text-violet-600">
                        🛋 Sofa bed to make up
                      </p>
                    )}
                    {booking.lateCheckout && (
                      <p className="text-sm font-semibold text-blue-500">
                        {booking.guest.name === "AirBnB"
                          ? booking.guest.alias || booking.alias || booking.guest.name
                          : booking.guest.name}{" "}
                        requested late checkout
                      </p>
                    )}
                    {isCompleted && (
                      <p className="text-sm text-gray-400">Cleaned on {item.completedDate}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          emptyState("All rooms clean")
        ))}

    </div>
  );
};

export default ToDoList;
