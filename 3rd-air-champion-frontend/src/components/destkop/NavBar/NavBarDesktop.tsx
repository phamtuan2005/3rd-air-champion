import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { FaCalendarAlt, FaClipboardList, FaDollarSign } from "react-icons/fa";
import { MdCleaningServices } from "react-icons/md";
import ProfileDesktop from "./ProfileDesktop";
import { FooterContext, GuestModeContext } from "../../../context";

interface AirBnBInfo {
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  airbnbRating: number | "";
  airbnbReviewCount: number | "";
  airbnbReviewsUrl: string;
  airbnbProfileUrl: string;
  cohostProfileUrl: string;
  airbnbSuperhost: boolean;
  highlights: string;
  houseRules: string;
  cleaningRules: string;
  phone: string;
  contactEmail: string;
  licenseNumber: string;
  cancellationFullRefundDays: number | "";
  cancellationHalfRefundDays: number | "";
}

interface NavBarDesktopProps {
  name: string;
  handleLogout: () => void;
  setIsAboutModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  airBnBInfo: AirBnBInfo;
  onAirBnBInfoSaved: (info: AirBnBInfo) => void;
  isFooterVisible: boolean;
  onToggleFooter: () => void;
  isTodoModalOpen: boolean;
  setIsTodoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBookModalOpen: boolean;
  setIsBookModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCleanersOpen: boolean;
  setIsCleanersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMiscOpen: boolean;
  setIsMiscOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAvailabilitiesModalOpen: boolean;
  setIsAvailabilitiesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockAirBnBModalOpen: boolean;
  setIsBlockAirBnBModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockRoomsModalOpen: boolean;
  setIsBlockRoomsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  airbnbPendingCount: number;
  availableNightsCount: number;
  todoCleanCount: number;
  cleanTodoCount: number;
  cleanUnassignedCount: number;
  isRequestManagerOpen: boolean;
  setIsRequestManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bookingRequestPendingCount: number;
  wishListAvailableCount: number;
}

const NavBarDesktop = ({
  name,
  handleLogout,
  setIsAboutModalOpen,
  airBnBInfo,
  onAirBnBInfoSaved,
  isFooterVisible,
  onToggleFooter,
  isTodoModalOpen,
  setIsTodoModalOpen,
  isBookModalOpen,
  setIsBookModalOpen,
  isCleanersOpen,
  setIsCleanersOpen,
  isMiscOpen,
  setIsMiscOpen,
  isAvailabilitiesModalOpen,
  setIsAvailabilitiesModalOpen,
  isBlockAirBnBModalOpen,
  setIsBlockAirBnBModalOpen,
  isBlockRoomsModalOpen,
  setIsBlockRoomsModalOpen,
  airbnbPendingCount,
  availableNightsCount,
  todoCleanCount,
  cleanTodoCount,
  cleanUnassignedCount,
  isRequestManagerOpen,
  setIsRequestManagerOpen,
  bookingRequestPendingCount,
  wishListAvailableCount,
}: NavBarDesktopProps) => {
  const { currentGuest, currentAirBnBGuest, setCurrentGuest, setCurrentAirBnBGuest } = useContext(GuestModeContext)!;
  const { setIsFooterVisible } = useContext(FooterContext)!;
  const isGuestMode = !!(currentGuest || currentAirBnBGuest);
  // The toolbar groups seven actions under three category buttons; tapping one
  // opens this picker. Keeps the bar from overflowing on a narrow phone.
  const [pickerGroup, setPickerGroup] = useState<null | "calendar" | "tasks" | "money">(null);

  const closeAllPanels = () => {
    setIsTodoModalOpen(false);
    setIsAvailabilitiesModalOpen(false);
    setIsBlockAirBnBModalOpen(false);
    setIsBlockRoomsModalOpen(false);
    setIsRequestManagerOpen(false);
  };

  // A pickable action within a category. `badges` surface pending counts both on
  // the category button (aggregated) and on the action card.
  type PickAction = {
    label: string;
    desc: string;
    emoji: React.ReactNode; // emoji string, or an icon component (e.g. Clean)
    hover: string; // per-card hover accent (hardcoded so Tailwind keeps the class)
    badges?: { n: number; cls: string }[];
    run: () => void;
  };

  const YELLOW = "bg-yellow-400 text-black";
  const GREEN = "bg-green-500 text-white";
  const ROSE = "bg-rose-500 text-white";

  const GROUPS: Record<
    "calendar" | "tasks" | "money",
    {
      title: string;
      icon: React.ReactNode;
      btn: string; // button background
      shadow: string; // active drop-shadow
      active: boolean;
      badges: { n: number; cls: string }[];
      actions: PickAction[];
    }
  > = {
    calendar: {
      title: "Calendar",
      icon: <FaCalendarAlt className="text-sm" />,
      btn: "bg-blue-500",
      shadow: "drop-shadow-[0_4px_6px_rgba(59,130,246,0.5)]",
      active: isBookModalOpen || isRequestManagerOpen || isBlockAirBnBModalOpen || isBlockRoomsModalOpen,
      badges: [
        { n: bookingRequestPendingCount + airbnbPendingCount, cls: YELLOW },
        { n: wishListAvailableCount, cls: GREEN },
      ],
      actions: [
        {
          label: "Book a stay",
          desc: "Create a new direct booking on the calendar.",
          emoji: "➕",
          hover: "hover:border-blue-300 hover:text-blue-600",
          run: () => setIsBookModalOpen(true),
        },
        {
          label: "Requests",
          desc: "Incoming booking requests and guest wish-lists.",
          emoji: "📩",
          hover: "hover:border-violet-300 hover:text-violet-600",
          badges: [
            { n: bookingRequestPendingCount, cls: YELLOW },
            { n: wishListAvailableCount, cls: GREEN },
          ],
          run: () => {
            closeAllPanels();
            setIsRequestManagerOpen(true);
          },
        },
        {
          label: "Block AirBnB",
          desc: "Mark non-AirBnB bookings as blocked on your AirBnB calendar.",
          emoji: "🛑",
          hover: "hover:border-rose-300 hover:text-rose-600",
          badges: [{ n: airbnbPendingCount, cls: YELLOW }],
          run: () => {
            closeAllPanels();
            setIsBlockAirBnBModalOpen(true);
          },
        },
        {
          label: "Block Rooms",
          desc: "Reserve specific rooms for a date range so they can't be booked.",
          emoji: "🔒",
          hover: "hover:border-orange-300 hover:text-orange-600",
          run: () => {
            closeAllPanels();
            setIsBlockRoomsModalOpen(true);
          },
        },
      ],
    },
    tasks: {
      title: "Tasks",
      icon: <FaClipboardList className="text-sm" />,
      btn: "bg-orange-500",
      shadow: "drop-shadow-[0_4px_6px_rgba(249,115,22,0.5)]",
      active: isTodoModalOpen || isCleanersOpen,
      badges: [
        { n: todoCleanCount + cleanTodoCount, cls: YELLOW },
        { n: cleanUnassignedCount, cls: ROSE },
      ],
      actions: [
        {
          label: "To Do",
          desc: "Today's guest reminders and cleaning checklist.",
          emoji: "✅",
          hover: "hover:border-gray-400 hover:text-gray-800",
          badges: [{ n: todoCleanCount, cls: YELLOW }],
          run: () => {
            closeAllPanels();
            setIsTodoModalOpen(true);
          },
        },
        {
          label: "Clean",
          desc: "Cleaner schedule, recorded hours and pay.",
          emoji: <MdCleaningServices className="text-teal-600" />,
          hover: "hover:border-orange-300 hover:text-orange-600",
          badges: [
            { n: cleanTodoCount, cls: YELLOW },
            { n: cleanUnassignedCount, cls: ROSE },
          ],
          run: () => setIsCleanersOpen(true),
        },
      ],
    },
    money: {
      title: "Money",
      icon: <FaDollarSign className="text-sm" />,
      btn: "bg-emerald-600",
      shadow: "drop-shadow-[0_4px_6px_rgba(5,150,105,0.5)]",
      active: isAvailabilitiesModalOpen || isMiscOpen,
      badges: [{ n: availableNightsCount, cls: YELLOW }],
      actions: [
        {
          label: "Stats",
          desc: "Occupancy, profit and booking trends.",
          emoji: "📊",
          hover: "hover:border-emerald-300 hover:text-emerald-600",
          badges: [{ n: availableNightsCount, cls: YELLOW }],
          run: () => {
            closeAllPanels();
            setIsAvailabilitiesModalOpen(true);
          },
        },
        {
          label: "Misc",
          desc: "House expenses — supplies, utilities, maintenance.",
          emoji: "🧾",
          hover: "hover:border-teal-300 hover:text-teal-600",
          run: () => setIsMiscOpen(true),
        },
      ],
    },
  };

  return (
    <div className="px-1 flex items-center justify-between w-full h-[80px] bg-white drop-shadow-md z-50 lg:h-[120px]">
      {/* Profile Section */}
      <div className="">
        <ProfileDesktop handleLogout={handleLogout} name={name} airBnBInfo={airBnBInfo} onAirBnBInfoSaved={onAirBnBInfoSaved} isFooterVisible={isFooterVisible} onToggleFooter={onToggleFooter}>
          {name}
        </ProfileDesktop>
      </div>

      {/* Centered Navigation Buttons */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Logo, inline with the title — also opens About */}
          <button
            type="button"
            onClick={() => setIsAboutModalOpen(true)}
            aria-label="About"
            title="About"
            className="shrink-0"
          >
            <img
              className="h-7 w-7 sm:h-10 sm:w-10"
              alt="TT House"
              src="./TiMagLogo.svg"
            />
          </button>
          <h1 className="p-1 sm:p-2 text-base sm:text-xl font-bold tracking-wide text-gray-800">
            TT House Manager
          </h1>
        </div>
        {isGuestMode ? (
          <button
            type="button"
            title="Back to full calendar"
            className="flex items-center gap-1.5 text-white bg-gray-700 hover:bg-gray-900 px-3 py-1.5 text-xs rounded-md transition-colors"
            onClick={() => {
              setIsFooterVisible(false);
              setCurrentGuest(null);
              setCurrentAirBnBGuest(null);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        ) : <div className="flex w-full justify-center gap-1.5 sm:w-auto sm:gap-2 [&>button]:min-w-0">
          {(["calendar", "tasks", "money"] as const).map((key) => {
            const g = GROUPS[key];
            return (
              <button
                key={key}
                type="button"
                title={g.title}
                onClick={() => setPickerGroup(key)}
                className={`relative flex flex-1 max-w-[8rem] items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-white whitespace-nowrap sm:max-w-none sm:flex-none sm:px-4 sm:text-sm ${g.btn} ${
                  g.active ? g.shadow : ""
                }`}
              >
                {g.icon}
                {g.title}
                {/* Aggregated pending badges so nothing hides behind the group */}
                {g.badges[0]?.n > 0 && (
                  <span className={`absolute -top-2 right-2 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${g.badges[0].cls}`}>
                    {g.badges[0].n}
                  </span>
                )}
                {g.badges[1]?.n > 0 && (
                  <span className={`absolute -top-2 left-2 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none ${g.badges[1].cls}`}>
                    {g.badges[1].n}
                  </span>
                )}
              </button>
            );
          })}
        </div>}
      </div>

      {/* Spacer — balances the profile on the left so the title stays centered.
          Desktop only; hidden on mobile where the button row needs the width. */}
      <div className="hidden shrink-0 sm:block sm:h-[76px] sm:w-[76px]" aria-hidden="true" />

      {/* Category action picker — opened by a group button, lists that group's
          actions as cards (same look as the old Block chooser). */}
      {pickerGroup && createPortal(
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300] p-4"
          onClick={() => setPickerGroup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
                <span className="text-gray-500">{GROUPS[pickerGroup].icon}</span>
                {GROUPS[pickerGroup].title}
              </h2>
              <button
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                onClick={() => setPickerGroup(null)}
              >
                &times;
              </button>
            </div>

            {/* Action cards */}
            <div className="p-4 flex flex-col gap-3">
              {GROUPS[pickerGroup].actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={`text-left w-full rounded-xl border-2 border-gray-200 bg-white px-5 py-4 transition-all hover:shadow-md ${a.hover}`}
                  onClick={() => {
                    setPickerGroup(null);
                    a.run();
                  }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg">{a.emoji}</span>
                    <span className="font-bold text-sm text-gray-800">{a.label}</span>
                    {a.badges && a.badges.some((b) => b.n > 0) && (
                      <span className="ml-auto flex items-center gap-1">
                        {a.badges.map(
                          (b, i) =>
                            b.n > 0 && (
                              <span
                                key={i}
                                className={`min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${b.cls}`}
                              >
                                {b.n}
                              </span>
                            ),
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-9">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NavBarDesktop;