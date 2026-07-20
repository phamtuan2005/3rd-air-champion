import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { FaBroom } from "react-icons/fa";
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
  isAvailabilitiesModalOpen: boolean;
  setIsAvailabilitiesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockAirBnBModalOpen: boolean;
  setIsBlockAirBnBModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockRoomsModalOpen: boolean;
  setIsBlockRoomsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  airbnbPendingCount: number;
  availableNightsCount: number;
  todoCleanCount: number;
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
  isAvailabilitiesModalOpen,
  setIsAvailabilitiesModalOpen,
  isBlockAirBnBModalOpen,
  setIsBlockAirBnBModalOpen,
  isBlockRoomsModalOpen,
  setIsBlockRoomsModalOpen,
  airbnbPendingCount,
  availableNightsCount,
  todoCleanCount,
  isRequestManagerOpen,
  setIsRequestManagerOpen,
  bookingRequestPendingCount,
  wishListAvailableCount,
}: NavBarDesktopProps) => {
  const { currentGuest, currentAirBnBGuest, setCurrentGuest, setCurrentAirBnBGuest } = useContext(GuestModeContext)!;
  const { setIsFooterVisible } = useContext(FooterContext)!;
  const isGuestMode = !!(currentGuest || currentAirBnBGuest);
  const [isBlockChooserOpen, setIsBlockChooserOpen] = useState(false);

  const isBlockActive = isBlockAirBnBModalOpen || isBlockRoomsModalOpen;

  const closeAllPanels = () => {
    setIsTodoModalOpen(false);
    setIsAvailabilitiesModalOpen(false);
    setIsBlockAirBnBModalOpen(false);
    setIsBlockRoomsModalOpen(false);
    setIsRequestManagerOpen(false);
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
      <div className="flex flex-col items-center gap-3">
        <h1 className="p-1 sm:p-2 text-base sm:text-xl font-bold tracking-wide text-gray-800">
          TT House Booking Manager
        </h1>
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
        ) : <div className="flex gap-1 sm:gap-2">
          <button
            type="button"
            className={`relative flex-1 text-white bg-black px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md whitespace-nowrap ${
              isTodoModalOpen ? "drop-shadow-[0_4px_6px_rgba(59,130,246,0.5)]" : ""
            }`}
            onClick={() => {
              closeAllPanels();
              setIsTodoModalOpen(!isTodoModalOpen);
            }}
          >
            To Do
            {todoCleanCount > 0 && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 min-w-[20px] h-5 px-1 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
                {todoCleanCount}
              </span>
            )}
          </button>
          <button
            type="button"
            title="Requests"
            className={`relative flex-1 text-white bg-amber-500 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md whitespace-nowrap ${
              isRequestManagerOpen ? "drop-shadow-[0_4px_6px_rgba(245,158,11,0.5)]" : ""
            }`}
            onClick={() => {
              closeAllPanels();
              setIsRequestManagerOpen(!isRequestManagerOpen);
            }}
          >
            Reqs
            {bookingRequestPendingCount > 0 && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 min-w-[20px] h-5 px-1 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
                {bookingRequestPendingCount}
              </span>
            )}
            {wishListAvailableCount > 0 && (
              <span className="absolute -top-4 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {wishListAvailableCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`flex-1 text-white bg-blue-500 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md ${
              isBookModalOpen ? "drop-shadow-[0_4px_6px_rgba(59,130,246,0.5)]" : ""
            }`}
            onClick={() => setIsBookModalOpen(true)}
          >
            Book
          </button>
          <button
            type="button"
            title="Availabilities"
            className={`relative flex-1 text-white bg-emerald-600 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md ${
              isAvailabilitiesModalOpen ? "drop-shadow-[0_4px_6px_rgba(59,130,246,0.5)]" : ""
            }`}
            onClick={() => {
              closeAllPanels();
              setIsAvailabilitiesModalOpen(!isAvailabilitiesModalOpen);
            }}
          >
            Avail
            {availableNightsCount > 0 && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 min-w-[20px] h-5 px-1 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
                {availableNightsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`relative flex-1 text-white bg-rose-500 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md whitespace-nowrap ${
              isBlockActive ? "drop-shadow-[0_4px_6px_rgba(244,63,94,0.5)]" : ""
            }`}
            onClick={() => setIsBlockChooserOpen(true)}
          >
            Block
            {airbnbPendingCount > 0 && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 min-w-[20px] h-5 px-1 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
                {airbnbPendingCount}
              </span>
            )}
          </button>
          {/* Cleaners — broom icon + short "Clean" caption (<=5 chars), end of bar */}
          <button
            type="button"
            aria-label="Clean"
            title="Clean"
            className={`flex flex-1 items-center justify-center gap-1 text-white bg-violet-500 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md whitespace-nowrap ${
              isCleanersOpen ? "drop-shadow-[0_4px_6px_rgba(139,92,246,0.5)]" : ""
            }`}
            onClick={() => setIsCleanersOpen((v) => !v)}
          >
            <FaBroom className="text-sm" />
            Clean
          </button>
        </div>}
      </div>

      {/* About */}
      <button type="button" onClick={() => setIsAboutModalOpen(true)}>
        <img
          className="h-[44px] w-[44px] sm:h-[76px] sm:w-[76px]"
          alt="About"
          title="About"
          src="./TiMagLogo.svg"
        ></img>
      </button>

      {/* Block chooser modal */}
      {isBlockChooserOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300]"
          onClick={() => setIsBlockChooserOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Block Dates</h2>
              <button
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                onClick={() => setIsBlockChooserOpen(false)}
              >
                &times;
              </button>
            </div>

            {/* Options */}
            <div className="p-4 flex flex-col gap-3">
              {/* Block AirBnB card */}
              <button
                type="button"
                className={`text-left w-full rounded-xl border-2 px-5 py-4 transition-all hover:shadow-md group ${
                  isBlockAirBnBModalOpen
                    ? "border-rose-400 bg-rose-50"
                    : "border-gray-200 hover:border-rose-300 bg-white"
                }`}
                onClick={() => {
                  closeAllPanels();
                  setIsBlockAirBnBModalOpen(true);
                  setIsBlockChooserOpen(false);
                }}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-lg">🛑</span>
                  <span className="font-bold text-sm text-gray-800 group-hover:text-rose-600">
                    Block AirBnB
                  </span>
                  {airbnbPendingCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
                      {airbnbPendingCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed pl-8">
                  Mark non-AirBnB bookings as blocked on your AirBnB calendar so guests cannot double-book those dates online.
                </p>
              </button>

              {/* Block Rooms card */}
              <button
                type="button"
                className={`text-left w-full rounded-xl border-2 px-5 py-4 transition-all hover:shadow-md group ${
                  isBlockRoomsModalOpen
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 hover:border-orange-300 bg-white"
                }`}
                onClick={() => {
                  closeAllPanels();
                  setIsBlockRoomsModalOpen(true);
                  setIsBlockChooserOpen(false);
                }}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-lg">🔒</span>
                  <span className="font-bold text-sm text-gray-800 group-hover:text-orange-600">
                    Block Rooms
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed pl-8">
                  Reserve specific rooms for a date range — preventing any new bookings from being made for those rooms during that period.
                </p>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NavBarDesktop;