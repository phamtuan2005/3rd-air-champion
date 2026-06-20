import { useState } from "react";
import { addDays, compareAsc, format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";

export interface IcsModalState {
  icsContent: string;
  phone: string;
  email?: string;
  guestName: string;
  guestDisplayName: string;
  checkinDate: string;
  checkoutDate: string;
  fileName: string;
}

interface UseMessagingParams {
  monthMap: Map<string, dayType>;
  currentMonth: Date;
  currentGuest: string | null;
  paidDates: Date[];
  airbnbName: string;
  airbnbAddress: string;
}

export const useMessaging = ({
  monthMap,
  currentMonth,
  currentGuest,
  paidDates,
  airbnbName,
  airbnbAddress,
}: UseMessagingParams) => {
  const [icsModal, setIcsModal] = useState<IcsModalState | null>(null);
  const [calEventsHint, setCalEventsHint] = useState<string | null>(null);

  const showCalEventsHint = (message: string) => {
    setCalEventsHint(message);
    setTimeout(() => setCalEventsHint(null), 4000);
  };

  const getCurrentGuestBill = (guest: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return Array.from(monthMap.entries()).reduce((total, [dateStr, dayEntry]) => {
      const date = toZonedTime(dateStr, timeZone);
      if (isSameMonth(date, currentMonth)) {
        const matchingBookings = dayEntry.bookings.filter(
          (booking) => booking.guest.name === guest && booking.startDate === dateStr,
        );
        return (
          total +
          matchingBookings.reduce((sum, booking) => {
            const pricePerNight =
              booking.guest.pricing.find((p) => p.room === booking.room.id)?.price ||
              booking.price;
            return sum + pricePerNight * booking.duration;
          }, 0)
        );
      }
      return total;
    }, 0);
  };

  const formatListWithAnd = (items: string[]): string => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  };

  const handleBookingConfirmation = (phone: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const uniqueMonths = new Set<string>(
      paidDates
        .filter((paidDate) => {
          const dateStr = paidDate.toISOString().split("T")[0];
          const dayEntry = monthMap.get(dateStr);
          return dayEntry?.bookings.some((b) => b.guest.phone === phone && !b.reserved) ?? false;
        })
        .map((paidDate) => startOfMonth(paidDate).toISOString().split("T")[0]),
    );
    const months = Array.from(uniqueMonths, (uniqueMonth) => toZonedTime(uniqueMonth, timeZone));
    const currentYear = new Date().getFullYear();
    const monthStrings = months.map((month) =>
      format(month, month.getFullYear() !== currentYear ? "LLLL yyyy" : "LLLL"),
    );

    const body = `Your bookings for ${
      monthStrings.length > 0
        ? formatListWithAnd(monthStrings)
        : format(currentMonth, currentMonth.getFullYear() !== currentYear ? "LLLL yyyy" : "LLLL")
    } are now as follows:\n`;

    const sortedEntries = Array.from(monthMap.entries()).sort(([dateStrA], [dateStrB]) => {
      const dateA = toZonedTime(dateStrA, timeZone);
      const dateB = toZonedTime(dateStrB, timeZone);
      return compareAsc(dateA, dateB);
    });

    let totalPriceOfMonth = 0;
    let guestName = "";
    let numberOfNights = 0;

    const bookingDetails = sortedEntries.reduce((acc, [dateStr, dayEntry]) => {
      const date = toZonedTime(dateStr, timeZone);

      if (
        (months.length > 0 && months.some((month) => isSameMonth(date, month))) ||
        isSameMonth(date, currentMonth)
      ) {
        const matchingBookings = dayEntry.bookings.filter(
          (booking) => booking.guest.phone === phone && booking.startDate.split("T")[0] === dateStr && !booking.reserved,
        );

        if (matchingBookings.length > 0) {
          const bookingText = matchingBookings
            .map((booking: bookingType) => {
              guestName = booking.guest.name;

              const startDate = toZonedTime(booking.startDate.split("T")[0], timeZone);
              const weekday = format(startDate, "EEE");
              const currentYear = new Date().getFullYear();
              const dateFormatted = format(startDate, startDate.getFullYear() !== currentYear ? "MMM d, yyyy" : "MMM d");
              const duration = booking.duration;
              const endDate = addDays(startDate, duration);
              const endWeekday = format(endDate, "EEE");
              const endDateFormatted = format(endDate, endDate.getFullYear() !== currentYear ? "MMM d, yyyy" : "MMM d");

              const roomName = booking.room.name;
              const pricePerNight =
                booking.guest.pricing.find((p) => p.room === booking.room.id)?.price ||
                booking.price;

              numberOfNights += duration;

              const paidNights = Array.from({ length: duration }, (_, i) => addDays(startDate, i))
                .filter((night) => paidDates.some((pd) => isSameDay(pd, night))).length;
              const bookingPaidAmount = paidNights * pricePerNight;
              const paidLabel = paidNights === 0 ? "" : `(paid $${bookingPaidAmount})`;

              if (duration === 1) {
                totalPriceOfMonth += pricePerNight;
                return `* ${weekday} to ${endWeekday} morning, ${dateFormatted} - ${endDateFormatted} morning, 1 night, ${roomName}, $${pricePerNight} ${paidLabel}`.trimEnd();
              } else {
                const totalPrice = pricePerNight * duration;
                totalPriceOfMonth += totalPrice;
                return `* ${weekday} to ${endWeekday} morning, ${dateFormatted} - ${endDateFormatted} morning, ${duration} nights, ${roomName}, $${pricePerNight} * ${duration} = $${totalPrice} ${paidLabel}`.trimEnd();
              }
            })
            .join("\n");
          return acc + bookingText + "\n";
        }
      }

      return acc;
    }, "");

    let totalPaidAmount = 0;
    paidDates.forEach((paidDate) => {
      const day = monthMap.get(paidDate.toISOString().split("T")[0]);
      if (!day) return;
      const booking = day.bookings.find((b) => b.guest.id === currentGuest && !b.reserved);
      if (!booking) return;
      const pricePerNight =
        booking.guest.pricing.find((p) => p.room === booking.room.id)?.price || booking.price;
      totalPaidAmount += pricePerNight;
    });

    const unpaid = totalPriceOfMonth - totalPaidAmount;
    const politePreface = `Many thanks for your ${numberOfNights === 1 ? "inquiry" : "inquiries"}!`;
    const accomodationPreface = numberOfNights > 3 ? "I do my best to accomodate you." : "";

    const fullBody = `${guestName === "" ? "" : `Hi ${guestName},`}\n${politePreface}${accomodationPreface ? `\n${accomodationPreface}` : ""}\n${body}${bookingDetails}\nTotal price = $${totalPriceOfMonth}${totalPaidAmount > 0 ? `\nTotal paid = $${totalPaidAmount}` : ""}${
      unpaid > 0
        ? `\nTo pay = ${totalPaidAmount > 0 ? `$${totalPriceOfMonth} - $${totalPaidAmount} = $${unpaid}` : `$${unpaid}`}`
        : ""
    }\n\nCould you please confirm whether everything is in order?`;

    window.location.href = `sms:${phone}?&body=${encodeURIComponent(fullBody)}`;
  };

  const handleSendCalEvents = (phone: string, email?: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const sortedEntries = Array.from(monthMap.entries()).sort(([a], [b]) =>
      compareAsc(toZonedTime(a, timeZone), toZonedTime(b, timeZone)),
    );

    const guestBookings: bookingType[] = [];
    for (const [dateStr, dayEntry] of sortedEntries) {
      const matching = dayEntry.bookings.filter(
        (b) =>
          b.guest.phone === phone &&
          b.startDate === dateStr &&
          paidDates.some((paidDate) =>
            isSameDay(toZonedTime(paidDate, timeZone), toZonedTime(dateStr, timeZone)),
          ),
      );
      guestBookings.push(...matching);
    }

    if (guestBookings.length === 0) {
      showCalEventsHint("Tap the guest's paid date(s) on the calendar first, then send Cal Events.");
      return;
    }

    const formatICSDateTime = (date: Date, hour: number) =>
      format(date, `yyyyMMdd'T'${String(hour).padStart(2, "0")}0000`);

    const icsEvents = guestBookings.map((booking) => {
      const checkinDate = toZonedTime(booking.startDate.split("T")[0], timeZone);
      const checkoutDate = addDays(checkinDate, booking.duration);
      return [
        "BEGIN:VEVENT",
        `DTSTART;TZID=${timeZone}:${formatICSDateTime(checkinDate, 14)}`,
        `DTEND;TZID=${timeZone}:${formatICSDateTime(checkoutDate, 11)}`,
        `SUMMARY:Stay at ${booking.room.name}${airbnbName ? ` @ ${airbnbName}` : ""}`,
        `DESCRIPTION:${booking.duration} night${booking.duration > 1 ? "s" : ""} at ${booking.room.name}`,
        ...(airbnbAddress ? [`LOCATION:${airbnbAddress.split("\n").join(", ")}`] : []),
        "END:VEVENT",
      ].join("\r\n");
    });

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//3rd Air Champion//Bookings//EN",
      "CALSCALE:GREGORIAN",
      ...icsEvents,
      "END:VCALENDAR",
    ].join("\r\n");

    const firstBooking = guestBookings[0];
    const lastBooking = guestBookings[guestBookings.length - 1];
    const guestDisplayName = firstBooking.guest.name.trim();
    const guestName = guestDisplayName.replace(/\s+/g, "_");
    const checkinDate = format(
      toZonedTime(firstBooking.startDate.split("T")[0], timeZone),
      "yyyy-MM-dd",
    );
    const lastCheckin = toZonedTime(lastBooking.startDate.split("T")[0], timeZone);
    const checkoutDate = format(addDays(lastCheckin, lastBooking.duration), "yyyy-MM-dd");

    setIcsModal({
      icsContent,
      phone,
      email,
      guestName,
      guestDisplayName,
      checkinDate,
      checkoutDate,
      fileName: `booking_${guestName}_${checkinDate}.ics`,
    });
  };

  return {
    icsModal,
    setIcsModal,
    getCurrentGuestBill,
    handleBookingConfirmation,
    handleSendCalEvents,
    calEventsHint,
  };
};