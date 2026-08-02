import { useEffect, useMemo, useState } from "react";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { addDays, format } from "date-fns";
import { getRoomColor } from "../../../../util/getRoomColor";
import { fetchAssignments, CleaningAssignmentType, CleanerType } from "../../../../util/cleanerOperations";
import CleanerAvatar from "../../../shared/CleanerAvatar";
import { cleanerSignoff } from "../../../../util/cleanerMessage";

interface RoomsToCleanProps {
  selectedDate: Date;
  monthMap: Map<string, dayType>;
  hostId?: string;
  token?: string | null;
  senderName?: string; // who's logged in — signs the cleaner text
}

const dk = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const cleaningTaskId = (endDate: string, roomId: string) => `clean-${endDate}-${roomId}`;

// Mirrors the ToDo modal's Cleaning tab: one card per room to clean on this date,
// leading with the assigned cleaner (avatar + name, tap to text), then the room
// chip and the arriving guest. Reserved (R) holds are included (they occupy).
const RoomsToClean = ({ selectedDate, monthMap, hostId, token, senderName }: RoomsToCleanProps) => {
  const [completedTasks, setCompletedTasks] = useState<
    Record<string, { completed: boolean; date: string | null }>
  >(() => JSON.parse(localStorage.getItem("completedTasks") || "{}"));
  useEffect(() => {
    localStorage.setItem("completedTasks", JSON.stringify(completedTasks));
  }, [completedTasks]);

  const selKey = dk(selectedDate);
  const yesterdayKey = dk(addDays(selectedDate, -1));

  // Rooms to clean this morning = stays whose LAST night was yesterday (they
  // check out today), plus the room's next check-in for setup context.
  const items = useMemo(() => {
    const checkouts =
      monthMap.get(yesterdayKey)?.bookings.filter(
        (b) => b.room != null && b.endDate.split("T")[0] === yesterdayKey,
      ) ?? [];
    return checkouts
      .map((booking) => {
        let nextCheckIn: bookingType | null = null;
        let nextCheckInDate: string | null = null;
        for (let i = 0; i <= 30; i++) {
          const key = dk(addDays(selectedDate, i));
          const found = monthMap
            .get(key)
            ?.bookings.find((b) => b.startDate.split("T")[0] === key && b.room?.id === booking.room?.id);
          if (found) {
            nextCheckIn = found;
            nextCheckInDate = key;
            break;
          }
        }
        return { booking, nextCheckIn, nextCheckInDate };
      })
      .sort((a, b) => {
        const pri = (it: { nextCheckIn: bookingType | null; booking: bookingType }) =>
          it.nextCheckIn?.earlyCheckin ? 0 : it.booking.lateCheckout ? 2 : 1;
        return pri(a) - pri(b);
      });
  }, [monthMap, yesterdayKey, selectedDate]);

  // Typical guest count per room (full history), to fill the cleaner text when a
  // room has no upcoming guest yet — same as the ToDo cleaning list.
  const roomAvgGuests = useMemo(() => {
    const acc = new Map<string, { total: number; count: number; seen: Set<string> }>();
    let gTotal = 0;
    let gCount = 0;
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
        gTotal += g;
        gCount += 1;
      });
    });
    const perRoom = new Map<string, number>();
    acc.forEach((e, id) => {
      if (e.count > 0) perRoom.set(id, Math.max(1, Math.round(e.total / e.count)));
    });
    const overall = gCount > 0 ? Math.max(1, Math.round(gTotal / gCount)) : 2;
    return (roomId?: string) => (roomId ? perRoom.get(roomId) : undefined) ?? overall;
  }, [monthMap]);

  // Cleaner assigned to each dirty room this morning (assignment date = today's
  // cleaning morning = the selected date).
  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  useEffect(() => {
    if (!hostId || !token) return;
    fetchAssignments(hostId, selKey, selKey, token)
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [hostId, token, selKey]);

  const cleanerFor = (roomId?: string): CleanerType | null =>
    roomId ? assignments.find((a) => a.date === selKey && a.room?.id === roomId)?.cleaner ?? null : null;

  const toggleTaskCompletion = (taskId: string) => {
    const currentDate = format(selectedDate, "MMM d, yyyy");
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: {
        completed: !prev[taskId]?.completed,
        date: !prev[taskId]?.completed ? currentDate : null,
      },
    }));
  };

  // Tap a cleaner → text them their rooms for this date (room + guest count, in
  // suggested order), same wording as the ToDo cleaning list.
  const textCleaner = (cleaner: CleanerType) => {
    if (!cleaner.phone) return;
    const first = cleaner.name.split(" ")[0];
    const mine = items.filter((it) => {
      const id = cleaningTaskId(it.booking.endDate, it.booking.room?.id ?? "");
      return !completedTasks[id]?.completed && cleanerFor(it.booking.room?.id)?.id === cleaner.id;
    });
    const dayLabel = format(selectedDate, "EEE, MMM d");
    let body: string;
    if (mine.length === 0) {
      body = `Hi ${first}! Looks like all your rooms for ${dayLabel} are done.\n\n` + cleanerSignoff(senderName);
    } else {
      const lines = mine.map((it, i) => {
        const room = it.booking.room?.name ?? "Room";
        const n = it.nextCheckIn?.numberOfGuests ?? roomAvgGuests(it.booking.room?.id);
        return `${i + 1}. ${room} — for ${n} guest${n === 1 ? "" : "s"}`;
      });
      body =
        `Hi ${first}! Cleaning for ${dayLabel} — ${mine.length} room${mine.length === 1 ? "" : "s"}, in suggested order:\n` +
        lines.join("\n") +
        `\n\n${cleanerSignoff(senderName)}`;
    }
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(body)}`;
  };

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col px-2 pt-2">
      {items.map(({ booking, nextCheckIn, nextCheckInDate }, index) => {
        const taskId = cleaningTaskId(booking.endDate, booking.room?.id ?? "");
        const isCompleted = completedTasks[taskId]?.completed ?? false;
        const cleaner = cleanerFor(booking.room?.id);
        const arrivesSameDay = nextCheckInDate === selKey;

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
            {/* Cleaner avatar — tap to text them this date's cleaning list.
                Unassigned rooms show the amber "!" marker. */}
            {cleaner ? (
              <button
                type="button"
                onClick={() => textCleaner(cleaner)}
                disabled={!cleaner.phone}
                title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} this day's cleaning list` : cleaner.name}
                className="shrink-0 rounded-full disabled:cursor-default"
              >
                <CleanerAvatar name={cleaner.name} photo={cleaner.photo} character={cleaner.character} sizeClass="h-9 w-9" />
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
              {cleaner ? (
                <button
                  type="button"
                  onClick={() => textCleaner(cleaner)}
                  disabled={!cleaner.phone}
                  title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} this day's cleaning list` : cleaner.name}
                  className="w-fit text-left no-underline disabled:cursor-default"
                >
                  <span className="text-sm font-bold text-gray-900 hover:underline">{cleaner.name}</span>
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
              {nextCheckIn && nextCheckInDate && (
                <p className={`text-xs ${arrivesSameDay ? "font-semibold text-red-500" : "text-gray-500"}`}>
                  {arrivesSameDay
                    ? "Checking in same day"
                    : `Arrives ${format(new Date(nextCheckInDate + "T00:00:00"), "EEE, MMM d")}`}
                </p>
              )}
              {nextCheckIn?.earlyCheckin && (
                <p className="text-xs font-semibold text-orange-500">Early Check-in Requested</p>
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
                <p className="text-xs text-gray-400">Cleaned on {completedTasks[taskId]?.date}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomsToClean;
