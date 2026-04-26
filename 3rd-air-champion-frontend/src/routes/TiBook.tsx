import { useEffect, useMemo, useState } from "react";
import CalendarNavigator from "../components/tibook/Calendar/CalendarNavigatorDesktop";
import NavBarDesktop from "../components/tibook/NavBarDesktop";
import host from "../util/types/TiBook/host.type";
import { fetchHost, getHosts } from "../util/hostOperations";
import { authorizeUser } from "../util/authorizeUser";
import { hostType } from "../util/types/hostType";
import { roomType } from "../util/types/roomType";
import Calendar from "../components/tibook/Calendar/Calendar";
import { dayType } from "../util/types/dayType";
import { fetchDays } from "../util/dayOperations";
import { toZonedTime } from "date-fns-tz";
import { fetchRooms } from "../util/roomOperations";
import BookingRequestModal from "../components/tibook/BookingRequestModal";

const TiBook = () => {
  // Auto login with TiBook account
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("tiBookToken") ?? null,
  );

  // Host states
  const [hosts, setHosts] = useState<host[]>([]);
  const [currentHost, setCurrentHost] = useState<hostType | null>(null);

  // Rooms states
  const [rooms, setRooms] = useState<roomType[]>([]);

  // Days states
  const [days, setDays] = useState<dayType[]>([]);

  // Calendar navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [selectedRoomName, setSelectedRoomName] = useState<string | null>(null);

  // Booking request modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Loading states
  const [isLoadingHosts, setIsLoadingHosts] = useState(false);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monthMap = useMemo(() => {
    const map = new Map<string, dayType>();
    days.forEach((day) => {
      const key = toZonedTime(day.date, timeZone).toISOString().split("T")[0];
      map.set(key, day);
    });
    return map;
  }, [days]);

  // IN FILE UTILS
  const authorizeTiBook = async () => {
    const tiBookEmail = import.meta.env.VITE_TI_BOOK_EMAIL;
    const tiBookPassword = import.meta.env.VITE_TI_BOOK_PASSWORD;
    return authorizeUser({ email: tiBookEmail, password: tiBookPassword })
      .then((result) => {
        return result.token;
      })
      .catch((err) => {
        console.error("Error authorizing user:", err);
      });
  };

  useEffect(() => {
    // Authorize user first
    authorizeTiBook().then((token) => {
      if (token) {
        setToken(token);
        localStorage.setItem("tiBookToken", token);
      }
    });
  }, []);

  useEffect(() => {
    if (token) {
      setIsLoadingHosts(true);
      getHosts(token)
        .then((hosts) => {
          setHosts(hosts);
          if (hosts.length > 0 && currentHost === null) {
            fetchHost(hosts[0].id, token as string).then((host) => {
              if (host) {
                setCurrentHost({ ...host, id: hosts[0].id });
              }
              fetchRooms(host?.id as string, token as string).then((rooms) => {
                setRooms(rooms);
              });
              fetchDays(host?.calendar as string, token as string).then(
                (days) => {
                  setDays(days);
                },
              );
            });
          }
        })
        .finally(() => {
          setIsLoadingHosts(false);
        });
    }
  }, [token]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBarDesktop />
      <CalendarNavigator
        currentMonth={currentMonth}
        hosts={hosts}
        rooms={rooms}
        setSelectedRoomName={setSelectedRoomName}
        setCurrentHost={setCurrentHost}
        setDays={setDays}
        setRooms={setRooms}
        onScrollToToday={() => setScrollToTodayTrigger((n) => n + 1)}
        onBookingRequest={() => {
          setSelectedDate(null);
          setIsBookingModalOpen(true);
        }}
      />
      {isLoadingHosts ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      ) : currentHost ? (
        <Calendar
          currentMonth={currentMonth}
          monthMap={monthMap}
          rooms={rooms}
          selectedRoomName={selectedRoomName}
          scrollToTodayTrigger={scrollToTodayTrigger}
          onMonthChange={setCurrentMonth}
          onDateClick={(date: Date) => {
            setSelectedDate(date);
            setIsBookingModalOpen(true);
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center flex-1">
          <h1 className="text-2xl font-bold">No host selected</h1>
        </div>
      )}
      {isBookingModalOpen && currentHost && (
        <BookingRequestModal
          hostId={currentHost.id}
          calendarId={currentHost.calendar}
          token={token as string}
          rooms={rooms}
          selectedDate={selectedDate}
          onClose={() => setIsBookingModalOpen(false)}
        />
      )}
    </div>
  );
};

export default TiBook;
