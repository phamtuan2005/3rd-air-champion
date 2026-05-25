import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { roomType } from "../../util/types/roomType";
import { dayType } from "../../util/types/dayType";
import { createBookingRequest, fetchBookingRequestsByGuest, fetchCalendarBookingsByGuest } from "../../util/bookingRequestOperations";
import { setGuestWishList } from "../../util/wishListOperations";
import { getAvailableRooms } from "../../util/bookingOperations";
import { fetchGuestByPhone } from "../../util/guestOperations";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import RoomBadge from "../shared/RoomBadge";
import GuestLoyaltyBanner from "./GuestLoyaltyBanner";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface BookingRequestModalProps {
  hostId: string;
  calendarId: string;
  token: string;
  rooms: roomType[];
  monthMap: Map<string, dayType>;
  selectedDate: Date | null;
  selectedRoomIds: Set<string> | null;
  cartDates: Map<string, string | null>;
  wishListDates?: Set<string>;
  savedPhone?: string;
  savedName?: string;
  onClose: () => void;
  onSuccess: () => void;
  onWishListSent?: (phone: string, name: string, newDates: string[]) => void;
  onRemoveWishDate?: (date: string) => void;
}

interface FormData {
  guestName: string;
  guestPhone: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
}

type GuestPricing = { id?: string; room: string; price: number }[];

type CartGroup = {
  key: string;
  roomId: string | null;
  room: roomType | undefined;
  ranges: { start: string; end: string; nights: number }[];
  totalNights: number;
};

const groupConsecutiveDates = (dates: Set<string>): { start: string; end: string; nights: number }[] => {
  const sorted = Array.from(dates).sort();
  if (sorted.length === 0) return [];
  const ranges: { start: string; end: string; nights: number }[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(end);
    prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().split("T")[0] === sorted[i]) {
      end = sorted[i];
    } else {
      const nights = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
      ranges.push({ start, end, nights });
      start = sorted[i];
      end = sorted[i];
    }
  }
  const nights = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  ranges.push({ start, end, nights });
  return ranges;
};

const buildCartGroups = (cartDates: Map<string, string | null>, rooms: roomType[]): CartGroup[] => {
  const byKey = new Map<string, Set<string>>();
  cartDates.forEach((roomId, dateKey) => {
    const key = roomId ?? "any";
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key)!.add(dateKey);
  });
  return Array.from(byKey.entries()).map(([key, dates]) => {
    const roomId = key === "any" ? null : key;
    const room = rooms.find((r) => r.id === roomId);
    const ranges = groupConsecutiveDates(dates);
    return { key, roomId, room, ranges, totalNights: ranges.reduce((sum, r) => sum + r.nights, 0) };
  });
};

const parseLocalDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const formatRangeLabel = (r: { start: string; end: string; nights: number }) => {
  const s = parseLocalDate(r.start);
  const e = parseLocalDate(r.end);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return r.start === r.end
    ? `${fmt(s)} · 1 night`
    : `${fmt(s)} – ${fmt(e)} · ${r.nights} nights`;
};

const BookingRequestModal = ({
  hostId,
  calendarId,
  token,
  rooms,
  monthMap,
  selectedDate,
  selectedRoomIds,
  cartDates,
  wishListDates,
  savedPhone = "",
  savedName = "",
  onClose,
  onSuccess,
  onWishListSent,
  onRemoveWishDate,
}: BookingRequestModalProps) => {
  const { theme } = useTiBookTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const [availableRooms, setAvailableRooms] = useState<
    { id: string; name: string; price: number; roomCode: string }[]
  >([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [hasFetchedRooms, setHasFetchedRooms] = useState(false);

  const [guestPricing, setGuestPricing] = useState<GuestPricing | null>(null);
  const [foundGuestName, setFoundGuestName] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [guestTotalStays, setGuestTotalStays] = useState(0);
  const [guestTotalNights, setGuestTotalNights] = useState(0);
  const [guestMemberSince, setGuestMemberSince] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [datesError, setDatesError] = useState("");
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [localWishList, setLocalWishList] = useState<Set<string>>(wishListDates ?? new Set());
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const cartGroups = useMemo(() => buildCartGroups(cartDates, rooms), [cartDates, rooms]);
  const hasAnyRoomGroup = cartGroups.some((g) => g.roomId === null);

  const activeRooms = rooms
    .filter((r) => r.active)
    .sort((a, b) => {
      const aSelected = selectedRoomIds?.has(a.id) ?? false;
      const bSelected = selectedRoomIds?.has(b.id) ?? false;
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return b.price - a.price;
    });

  const availableRoomsForAnyGroup = useMemo(() => {
    const anyGroup = cartGroups.find((g) => g.roomId === null);
    if (!anyGroup) return activeRooms;
    const allDates = anyGroup.ranges.flatMap(({ start, end }) => {
      const dates: string[] = [];
      const cur = new Date(start);
      const last = new Date(end);
      while (cur <= last) { dates.push(cur.toISOString().split("T")[0]); cur.setDate(cur.getDate() + 1); }
      return dates;
    });
    const bookedIds = new Set(
      allDates.flatMap((d) => monthMap.get(d)?.bookings.map((b) => b.room?.id).filter(Boolean) ?? [])
    );
    return activeRooms.filter((r) => !bookedIds.has(r.id));
  }, [cartGroups, monthMap, activeRooms]);

  const defaultDate = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      guestName: savedName,
      guestPhone: savedPhone,
      date: defaultDate,
      room: activeRooms.find((r) => selectedRoomIds?.has(r.id))?.id ?? activeRooms[0]?.id ?? "",
      duration: 0,
      numberOfGuests: 1,
    },
  });

  const watchedDate = watch("date");
  const watchedDuration = watch("duration");
  const watchedRoom = watch("room");
  const watchedPhone = watch("guestPhone");

  // Phone lookup with debounce
  useEffect(() => {
    const phone = watchedPhone?.trim();
    if (!phone || phone.length < 7) {
      setGuestPricing(null);
      setFoundGuestName(null);
      setGuestTotalStays(0);
      setGuestTotalNights(0);
      setGuestMemberSince(null);
      return;
    }
    setIsLookingUp(true);
    const timer = setTimeout(() => {
      Promise.all([
        fetchGuestByPhone(phone, hostId),
        fetchBookingRequestsByGuest(hostId, phone),
        fetchCalendarBookingsByGuest(calendarId, phone),
      ])
        .then(([guest, requests, calBookings]) => {
          setGuestPricing(guest ? guest.pricing : null);
          if (guest?.name) { setValue("guestName", guest.name); setFoundGuestName(guest.name); }
          else setFoundGuestName(null);

          const all = [...(calBookings ?? []), ...(requests ?? [])];
          setGuestTotalStays(all.length);
          setGuestTotalNights(all.reduce((sum, b) => sum + (b.duration ?? 1), 0));
          if (all.length > 0) {
            const earliest = all
              .map((b) => parseISO(String(b.date).slice(0, 10)))
              .sort((a, z) => a.getTime() - z.getTime())[0];
            setGuestMemberSince(format(earliest, "MMM yyyy"));
          } else {
            setGuestMemberSince(null);
          }
        })
        .finally(() => setIsLookingUp(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [watchedPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available rooms — only for Way 2 (no cart dates)
  useEffect(() => {
    if (cartDates.size > 0) return;
    if (!watchedDate || !watchedDuration) return;
    const dateStr = toZonedTime(new Date(watchedDate), timeZone).toISOString().split("T")[0];
    setIsLoadingRooms(true);
    getAvailableRooms({ calendar: calendarId, date: dateStr, duration: watchedDuration }, token)
      .then((result) => {
        setAvailableRooms(result);
        setHasFetchedRooms(true);
        if (result.length > 0) {
          const currentStillAvailable = result.find((r) => r.id === watchedRoom);
          if (!currentStillAvailable) setValue("room", result[0].id);
        } else {
          setValue("room", "");
        }
      })
      .catch(() => { setAvailableRooms([]); setHasFetchedRooms(true); })
      .finally(() => setIsLoadingRooms(false));
  }, [watchedDate, watchedDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayRooms = cartDates.size > 0
    ? activeRooms
    : (hasFetchedRooms ? availableRooms : activeRooms);

  const getRoomPrice = (roomId: string): number | null => {
    if (!guestPricing) return null;
    return guestPricing.find((p) => p.room === roomId)?.price ?? null;
  };

  const sortedWishListDates = [...localWishList].sort();
  const hasWishList = sortedWishListDates.length > 0;

  const handleNextStep = () => {
    if (cartDates.size === 0 && !notes.trim() && !hasWishList) {
      setDatesError("Please pick dates on the calendar or write your dates below.");
      return;
    }
    setDatesError("");
    setStep(2);
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(false);

    try {
      const requests: Promise<unknown>[] = [];

      if (cartDates.size > 0) {
        cartGroups.forEach((group) => {
          const roomId = group.roomId ?? data.room;
          group.ranges.forEach((range) => {
            const notesText = [
              "Dates from calendar: " + formatRangeLabel(range),
              notes.trim(),
            ].filter(Boolean).join("\n");
            requests.push(createBookingRequest({
              host: hostId,
              guestName: data.guestName,
              guestPhone: data.guestPhone,
              date: range.start,
              room: roomId,
              duration: range.nights,
              numberOfGuests: data.numberOfGuests,
              notes: notesText,
            }));
          });
        });
      } else if (notes.trim()) {
        requests.push(createBookingRequest({
          host: hostId,
          guestName: data.guestName,
          guestPhone: data.guestPhone,
          date: data.date.split("T")[0],
          room: data.room,
          duration: data.duration,
          numberOfGuests: data.numberOfGuests,
          notes: notes.trim(),
        }));
      }

      if (hasWishList) {
        requests.push(
          setGuestWishList({
            host: hostId,
            guestPhone: data.guestPhone,
            guestName: data.guestName,
            dates: sortedWishListDates,
          }).then((result) => {
            onWishListSent?.(data.guestPhone, data.guestName, result.dates);
          })
        );
      }

      await Promise.all(requests);
      setSubmitted(true);
    } catch {
      setSubmitError(true);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const stepLabel = step === 1 ? "Your Dates" : "About You";
  const stepHint = step === 1
    ? "Pick dates from the calendar or write them below"
    : "Just a few details and you're done";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full rounded-t-2xl sm:rounded-lg shadow-lg sm:max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              {step === 2 && !submitted && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-gray-400 hover:text-gray-600 text-sm leading-none"
                >
                  ←
                </button>
              )}
              <h2 className="text-lg font-bold leading-tight">{submitted ? "All done!" : stepLabel}</h2>
            </div>
            {!submitted && <p className="text-xs text-gray-400">{stepHint}</p>}
          </div>
          <div className="flex items-center gap-3">
            {!submitted && (
              <div className="flex gap-1">
                <span className={`w-2 h-2 rounded-full ${step === 1 ? theme.btn : "bg-gray-200"}`} />
                <span className={`w-2 h-2 rounded-full ${step === 2 ? theme.btn : "bg-gray-200"}`} />
              </div>
            )}
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Success screen */}
        {submitted ? (
          <div className="flex flex-col items-center gap-3 p-8">
            <div className={`w-14 h-14 rounded-full ${theme.successBg} flex items-center justify-center`}>
              <svg className={`w-7 h-7 ${theme.textPrimary}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-center font-semibold text-gray-800 text-lg">Request sent!</p>
            <p className="text-center text-sm text-gray-500 leading-relaxed">
              {cartDates.size > 0
                ? "We'll be in touch shortly to confirm your stay. Can't wait to host you!"
                : "We'll let you know as soon as those dates open up!"}
              {hasWishList && cartDates.size > 0 && " We'll also notify you if your wish list dates become available."}
            </p>
            <button
              type="button"
              className="mt-2 text-sm text-gray-400 underline"
              onClick={() => { onSuccess(); onClose(); }}
            >
              Close
            </button>
          </div>
        ) : step === 1 ? (
          /* ── Step 1: Your Dates ── */
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

              {/* Cart groups */}
              <div>
                <p className="text-sm font-medium mb-2">Dates picked from calendar</p>
                {cartGroups.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {cartGroups.map((group) => (
                      <div key={group.key}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {group.room ? (
                            <RoomBadge room={group.room} rooms={activeRooms} />
                          ) : (
                            availableRoomsForAnyGroup.map((r) => (
                              <RoomBadge key={r.id} room={r} rooms={activeRooms} />
                            ))
                          )}
                          <span className="text-xs text-gray-400">
                            {group.totalNights} night{group.totalNights > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 pl-1">
                          {group.ranges.map((r) => (
                            <p key={r.start} className="text-sm text-gray-600">{formatRangeLabel(r)}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={onClose}
                      className={`mt-1 flex items-center gap-1.5 text-xs ${theme.textPrimary} font-medium`}
                    >
                      <span className={`w-5 h-5 rounded-full border-2 ${theme.selectedBorder} flex items-center justify-center text-[10px]`}>+</span>
                      Calendar — tap to pick more dates
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full border border-dashed border-gray-200 rounded-xl px-4 py-5 text-center bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <p className={`text-sm font-medium ${theme.textPrimary}`}>
                      Tap here to browse the calendar
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Pick your dates and come back to complete your request
                    </p>
                  </button>
                )}
              </div>

              {/* Wish list dates */}
              {hasWishList && (
                <div>
                  <p className="text-sm font-medium mb-2">Sold-out dates (wish list)</p>
                  <div className="flex flex-col gap-1.5">
                    {sortedWishListDates.map((d) => (
                      <div key={d} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${pendingRemove === d ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                        {pendingRemove === d ? (
                          <>
                            <span className="flex-1 text-sm text-red-600 font-medium">Remove {format(new Date(d + "T12:00:00"), "MMM d")}?</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalWishList((prev) => { const next = new Set(prev); next.delete(d); return next; });
                                onRemoveWishDate?.(d);
                                setPendingRemove(null);
                              }}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-0.5 rounded-lg border border-red-300 hover:border-red-400 transition-colors"
                            >
                              Yes, remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingRemove(null)}
                              className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded-lg border border-gray-200 transition-colors"
                            >
                              Keep
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-amber-500 text-sm">★</span>
                            <span className="flex-1 text-sm text-gray-700 font-medium">
                              {format(new Date(d + "T12:00:00"), "EEE, MMM d yyyy")}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPendingRemove(d)}
                              className="text-gray-400 hover:text-red-400 transition-colors text-base leading-none px-1"
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">We'll notify you if these open up.</p>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">and / or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Free text */}
              <div>
                <p className="text-sm font-medium mb-2">Write your dates</p>
                <textarea
                  className={`border border-gray-300 rounded-xl px-3 py-2 w-full text-sm resize-none focus:outline-none focus:ring-2 ${theme.focusRing}`}
                  rows={3}
                  placeholder={"e.g. May 1, 3–5, 20–21\nor anything else you'd like us to know"}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); if (datesError) setDatesError(""); }}
                />
                {datesError && <p className="text-red-500 text-xs mt-1">{datesError}</p>}
              </div>

            </div>
            <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                className={`w-full ${theme.btn} ${theme.btnHover} ${theme.btnActive} text-white py-3 rounded-xl font-semibold transition-colors`}
                onClick={handleNextStep}
              >
                Next — Tell us about you →
              </button>
            </div>
          </div>
        ) : (
          /* ── Step 2: About You ── */
          <form className="flex flex-col flex-1 min-h-0" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium mb-1">Your phone number</label>
                <div className="relative">
                  <input
                    type="tel"
                    className={`border border-gray-300 rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`}
                    placeholder="So we can reach you"
                    {...register("guestPhone", { required: "Please enter your phone number" })}
                  />
                  {isLookingUp && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      looking up...
                    </span>
                  )}
                </div>
                {errors.guestPhone && <span className="text-red-500 text-xs">{errors.guestPhone.message}</span>}
                {!isLookingUp && watchedPhone?.trim().length >= 7 && (
                  guestPricing === null && (
                    <p className="text-xs text-gray-400 mt-0.5">We'll sort out pricing together after your request.</p>
                  )
                )}
              </div>

              {/* Returning guest banner */}
              {!isLookingUp && foundGuestName && (
                <GuestLoyaltyBanner
                  firstName={foundGuestName.split(" ")[0]}
                  totalStays={guestTotalStays}
                  totalNights={guestTotalNights}
                  memberSince={guestMemberSince}
                />
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Your name</label>
                <input
                  type="text"
                  className={`border border-gray-300 rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`}
                  placeholder="e.g. John Smith"
                  {...register("guestName", { required: "Please enter your name" })}
                />
                {errors.guestName && <span className="text-red-500 text-xs">{errors.guestName.message}</span>}
              </div>

              {/* Room section */}
              {cartDates.size > 0 ? (
                <div>
                  <label className="block text-sm font-medium mb-2">Room summary</label>
                  <div className="flex flex-col gap-2">
                    {cartGroups.filter((g) => g.roomId !== null).map((group) => (
                      <div key={group.key} className={`${theme.tagBg} border ${theme.tagBorder} rounded-xl px-3 py-2.5`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className={`text-sm font-semibold ${theme.tagText}`}>
                            {group.room?.name ?? "—"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {group.totalNights}n
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {group.ranges.map(formatRangeLabel).join(" · ")}
                        </p>
                        {group.room && getRoomPrice(group.room.id) !== null && (
                          <p className={`text-xs font-semibold ${theme.textPrimary} mt-1`}>
                            ~${getRoomPrice(group.room.id)! * group.totalNights} estimated
                          </p>
                        )}
                      </div>
                    ))}
                    {hasAnyRoomGroup && (() => {
                      const anyGroup = cartGroups.find((g) => g.roomId === null)!;
                      const selectedRoom = activeRooms.find((r) => r.id === watchedRoom);
                      const anyGroupPrice = selectedRoom ? getRoomPrice(selectedRoom.id) : null;
                      return (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">
                            Which room for{" "}
                            {anyGroup.ranges.map(formatRangeLabel).join(", ")}?
                          </p>
                          <input type="hidden" {...register("room", { required: hasAnyRoomGroup })} />
                          <button
                            type="button"
                            onClick={() => setRoomDropdownOpen((o) => !o)}
                            className="border border-gray-300 rounded-xl px-3 py-2 w-full text-sm flex items-center justify-between gap-2"
                          >
                            {selectedRoom ? (
                              <RoomBadge room={selectedRoom} rooms={activeRooms} />
                            ) : (
                              <span className="text-gray-400">Select a room</span>
                            )}
                            <span className="text-gray-400 text-xs">▾</span>
                          </button>
                          {roomDropdownOpen && (
                            <ul className="border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-sm bg-white">
                              {availableRoomsForAnyGroup.map((room) => {
                                const price = getRoomPrice(room.id);
                                return (
                                  <li
                                    key={room.id}
                                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => { setValue("room", room.id, { shouldValidate: true }); setRoomDropdownOpen(false); }}
                                  >
                                    <input type="radio" readOnly checked={watchedRoom === room.id} className="pointer-events-none w-4 h-4" />
                                    <RoomBadge room={room} rooms={activeRooms} />
                                    {price !== null && (
                                      <span className="text-xs text-gray-400 ml-auto">${price}/night</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {anyGroupPrice !== null && (
                            <p className={`text-xs font-semibold ${theme.textPrimary} mt-1.5`}>
                              ~${anyGroupPrice * anyGroup.totalNights} estimated ({anyGroup.totalNights}n × ${anyGroupPrice}/night)
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Grand total across all groups */}
                    {(() => {
                      let total = 0;
                      let hasSomePricing = false;
                      for (const group of cartGroups) {
                        const roomId = group.roomId ?? watchedRoom ?? null;
                        if (!roomId) continue;
                        const price = getRoomPrice(roomId);
                        if (price === null) continue;
                        hasSomePricing = true;
                        total += price * group.totalNights;
                      }
                      if (!hasSomePricing) return null;
                      return (
                        <div className={`flex justify-between items-center px-3 py-2 ${theme.tagBg} border ${theme.tagBorder} rounded-xl mt-1`}>
                          <span className="text-sm font-semibold text-gray-700">Total estimate</span>
                          <span className={`text-sm font-bold ${theme.textPrimary}`}>~${total}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Which room?</label>
                  {isLoadingRooms ? (
                    <p className="text-sm text-gray-400">Checking availability...</p>
                  ) : displayRooms.length === 0 ? (
                    <p className="text-sm text-red-400">No rooms available — try different dates.</p>
                  ) : (() => {
                    const selectedRoom = activeRooms.find((r) => r.id === watchedRoom);
                    return (
                      <>
                        <input type="hidden" {...register("room", { required: "Please choose a room" })} />
                        <button
                          type="button"
                          onClick={() => setRoomDropdownOpen((o) => !o)}
                          className="border border-gray-300 rounded-xl px-3 py-2 w-full text-sm flex items-center justify-between gap-2"
                        >
                          {selectedRoom ? (
                            <RoomBadge room={selectedRoom} rooms={activeRooms} />
                          ) : (
                            <span className="text-gray-400">Select a room</span>
                          )}
                          <span className="text-gray-400 text-xs">▾</span>
                        </button>
                        {roomDropdownOpen && (
                          <ul className="border border-gray-200 rounded-xl mt-1 overflow-hidden shadow-sm bg-white">
                            {displayRooms.map((room) => {
                              const price = getRoomPrice(room.id);
                              return (
                                <li
                                  key={room.id}
                                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => { setValue("room", room.id, { shouldValidate: true }); setRoomDropdownOpen(false); }}
                                >
                                  <input type="radio" readOnly checked={watchedRoom === room.id} className="pointer-events-none w-4 h-4" />
                                  <RoomBadge room={room} rooms={activeRooms} />
                                  {price !== null && (
                                    <span className="text-xs text-gray-400 ml-auto">${price}/night</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    );
                  })()}
                  {errors.room && <span className="text-red-500 text-xs">{errors.room.message}</span>}
                  {watchedRoom && watchedDuration > 0 && getRoomPrice(watchedRoom) !== null && (
                    <div className={`flex justify-between items-center px-3 py-2 ${theme.tagBg} border ${theme.tagBorder} rounded-xl mt-2`}>
                      <span className="text-sm font-semibold text-gray-700">Total estimate</span>
                      <span className={`text-sm font-bold ${theme.textPrimary}`}>
                        ~${getRoomPrice(watchedRoom)! * watchedDuration}
                        <span className="font-normal text-gray-400 ml-1">({watchedDuration}n × ${getRoomPrice(watchedRoom)}/night)</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Number of guests */}
              <div className="w-44">
                <label className="block text-sm font-medium mb-1">How many people?</label>
                <select
                  className={`border border-gray-300 rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`}
                  {...register("numberOfGuests", { valueAsNumber: true })}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
                  ))}
                </select>
              </div>

              {submitError && (
                <p className="text-red-500 text-sm">Something went wrong — please try again.</p>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3">
              <button
                type="submit"
                disabled={isSubmitting || (cartDates.size === 0 && displayRooms.length === 0)}
                className={`w-full ${theme.btn} ${theme.btnHover} ${theme.btnActive} text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors`}
              >
                {isSubmitting ? "Sending..." : "Send My Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BookingRequestModal;