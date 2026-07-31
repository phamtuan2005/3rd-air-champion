import { useEffect, useMemo, useRef, useState } from "react";
import { dayType } from "../../../util/types/dayType";
import { bookingType } from "../../../util/types/bookingType";
import { addDays, startOfToday, format } from "date-fns";
import { getRoomColor } from "../../../util/getRoomColor";
import { DEFAULT_TEMPLATE, TEMPLATE_KEY, resolveTemplate } from "../../../util/reminderTemplate";
import { CLEANING_LOOKBACK_DAYS, cleaningTaskId, getCleaningCounts, getCleaningItems, CleaningItem } from "../../../util/cleaningTasks";
import { fetchAssignments, CleaningAssignmentType, CleanerType } from "../../../util/cleanerOperations";
import CleanerAvatar from "../../shared/CleanerAvatar";

interface ToDoListProps {
  monthMap: Map<string, dayType>;
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  houseRules?: string;
  hostId?: string;
  token?: string | null;
}

type TabKey = "reminders" | "cleaning";

const ToDoList = ({ monthMap, doorCode, airbnbName, airbnbAddress, houseRules = "", hostId, token }: ToDoListProps) => {
  // Reminders / Cleaning = today's actionable tasks.
  const [activeTab, setActiveTab] = useState<TabKey>("reminders");

  const [completedTasks, setCompletedTasks] = useState<
    Record<string, { completed: boolean; date: string | null }>
  >(() => JSON.parse(localStorage.getItem("completedTasks") || "{}"));

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
    () => getCleaningItems(monthMap, completedTasks),
    [monthMap, completedTasks],
  );
  const cleaningCounts = getCleaningCounts(cleaningItems);

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

  // Tapping a cleaner's name/avatar texts them their whole assignment for today
  // — every room they're on that still needs cleaning, in the same urgency order
  // the list uses (soonest check-ins first), with who's arriving into each.
  const textCleanerSummary = (cleaner: CleanerType) => {
    if (!cleaner.phone) return;
    const first = cleaner.name.split(" ")[0];
    // cleaningItems is already sorted by urgency → this IS the suggested order.
    const mine = cleaningItems.filter(
      (it) => !it.isCompleted && cleanerFor(it)?.id === cleaner.id,
    );
    const dayLabel = format(startOfToday(), "EEE, MMM d");

    let body: string;
    if (mine.length === 0) {
      body = `Hi ${first}! Looks like all your rooms for ${dayLabel} are done — thank you! 🙏`;
    } else {
      const lines = mine.map((it, i) => {
        const room = it.booking.room?.name ?? "Room";
        const n = it.nextCheckIn?.numberOfGuests;
        const who = n ? ` (${n} guest${n === 1 ? "" : "s"})` : "";
        const when = it.mustCleanToday
          ? "guest arrives TODAY"
          : it.nextCheckInDate
            ? `next check-in ${format(new Date(it.nextCheckInDate + "T00:00:00"), "MMM d")}`
            : "no upcoming check-in";
        const early = it.nextCheckIn?.earlyCheckin ? " — EARLY check-in" : "";
        return `${i + 1}. ${room} — ${when}${who}${early}`;
      });
      body =
        `Hi ${first}! Cleaning for ${dayLabel} — ${mine.length} room${mine.length === 1 ? "" : "s"}, ` +
        `in suggested order (soonest check-ins first):\n` +
        lines.join("\n") +
        `\n\nThank you! 🙏`;
    }
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(body)}`;
  };

  useEffect(() => {
    localStorage.setItem("completedTasks", JSON.stringify(completedTasks));
  }, [completedTasks]);

  // Once data arrives, open on the first tab that has work (Reminders →
  // Cleaning). Runs once; never overrides a tab the user tapped.
  const autoTabDone = useRef(false);
  useEffect(() => {
    if (autoTabDone.current || monthMap.size === 0) return;
    autoTabDone.current = true;
    if (reminderBookings.length === 0 && cleaningItems.length > 0) setActiveTab("cleaning");
  }, [monthMap, reminderBookings, cleaningItems]);

  const toggleTaskCompletion = (taskId: string) => {
    const currentDate = format(startOfToday(), "MMM d, yyyy");
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: {
        completed: !prev[taskId]?.completed,
        date: !prev[taskId]?.completed ? currentDate : null,
      },
    }));
  };

  const generateTaskId = (
    startDate: string,
    endDate: string,
    guestId: string,
    roomId: string,
  ) => `${startDate}-${endDate}-${guestId}-${roomId}`;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "reminders", label: "Reminders", count: reminderBookings.length },
    { key: "cleaning", label: "Cleaning", count: cleaningCounts.max },
  ];

  const emptyState = (message: string) => (
    <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
      {message}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 pb-3">
      <div className="pb-2 pt-3 text-center">
        <h1 className="text-lg font-bold tracking-tight text-gray-900">To Do</h1>
        <p className="text-xs text-gray-400">{format(startOfToday(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="mb-3 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none ${
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
            <p className="mb-2 text-center text-xs text-gray-400">
              Guests checking in tomorrow ({format(addDays(startOfToday(), 1), "MMM d")})
            </p>
            {reminderBookings.map((booking, index) => {
              const taskId = generateTaskId(
                booking.startDate,
                booking.endDate,
                booking.guest.id,
                booking.room.id,
              );
              const task = completedTasks[taskId] || { completed: false, date: null };
              const isCompleted = task.completed;

              return (
                <div
                  key={`reminder-${index}`}
                  className={`mb-2 flex items-center gap-3 rounded-xl border border-gray-200 p-3 ${
                    isCompleted ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-black"
                    checked={isCompleted}
                    onChange={() => toggleTaskCompletion(taskId)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                      }`}
                    >
                      {booking.guest.alias || booking.alias || booking.guest.name}
                    </p>
                    <span
                      className={`${getRoomColor(booking.room.name, booking.room.color)} mt-0.5 inline-block rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                    >
                      {booking.room.name}
                    </span>
                    {isCompleted && (
                      <p className="mt-0.5 text-xs text-gray-400">Sent on {task.date}</p>
                    )}
                  </div>
                  {!booking.description ? (
                    <button
                      className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={() => {
                        const phone = booking.guest.phone;
                        const startDate = format(addDays(startOfToday(), 1), "MMMM do");
                        const currentTemplate = localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
                        const message = resolveTemplate(currentTemplate, buildStayChain(booking), startDate, doorCode, airbnbName, airbnbAddress, houseRules);
                        window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
                        toggleTaskCompletion(taskId);
                      }}
                      disabled={isCompleted}
                    >
                      Send Reminder
                    </button>
                  ) : (
                    <button
                      className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
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

      {activeTab === "cleaning" &&
        (cleaningItems.length > 0 ? (
          <>
            {cleaningCounts.min !== cleaningCounts.max && (
              <p className="mb-2 text-center text-xs text-gray-400">
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
                  className={`mb-2 flex items-start gap-2.5 rounded-xl border border-gray-200 p-3 ${
                    isCompleted ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-black"
                    checked={isCompleted}
                    onChange={() => toggleTaskCompletion(taskId)}
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600">
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
                        <span className="text-sm font-bold text-gray-900 hover:underline">
                          {cleaner.name}
                        </span>
                      </button>
                    ) : (
                      <span className="text-sm font-bold text-amber-600">Unassigned</span>
                    )}
                    {/* Room + who's arriving into it */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`${getRoomColor(booking.room.name, booking.room.color)} rounded-md px-2 py-0.5 text-xs font-bold ${
                          nextCheckIn?.guest.name === "AirBnB" ? "text-white" : "text-black"
                        }`}
                      >
                        {booking.room.name}
                      </span>
                      {nextCheckIn ? (
                        <span className="text-xs text-gray-600">
                          <span className="font-semibold text-gray-800">
                            {nextCheckIn.guest.alias || nextCheckIn.alias || nextCheckIn.guest.name}
                          </span>{" "}
                          · {nextCheckIn.numberOfGuests}{" "}
                          {nextCheckIn.numberOfGuests === 1 ? "guest" : "guests"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No upcoming check-in</span>
                      )}
                    </div>
                    {/* Arrival timing / urgency */}
                    {nextCheckIn && nextCheckInDate && (
                      <p
                        className={`text-xs ${
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
                      <p className="text-xs text-gray-500">Checked out this morning</p>
                    ) : (
                      <p className="text-xs font-semibold text-amber-600">
                        Empty since {format(addDays(new Date(item.checkoutKey + "T00:00:00"), 1), "MM/dd")} — not cleaned yet
                      </p>
                    )}
                    {nextCheckIn?.earlyCheckin && (
                      <p className="text-xs font-semibold text-orange-500">
                        Early Check-in Requested
                      </p>
                    )}
                    {booking.lateCheckout && (
                      <p className="text-xs font-semibold text-blue-500">
                        {booking.guest.name === "AirBnB"
                          ? booking.guest.alias || booking.alias || booking.guest.name
                          : booking.guest.name}{" "}
                        requested late checkout
                      </p>
                    )}
                    {isCompleted && (
                      <p className="text-xs text-gray-400">Cleaned on {item.completedDate}</p>
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
