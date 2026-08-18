import { useEffect, useState } from "react";
import { fetchHost, getHost, getCohostName } from "./util/hostOperations";
import { hostType } from "./util/types/hostType";
import { useNavigate } from "react-router";
import NavBarDesktop from "./components/destkop/NavBar/NavBarDesktop";
import MainView from "./components/destkop/MainView/MainView";
import About from "./components/About";
import { clearSession } from "./util/authSession";
import {
  isSyncModalOpenContext,
  AddPaneContext,
  FooterContext,
  GuestModeContext,
} from "./context";

function App() {
  useEffect(() => { document.title = "TiMag"; }, []);

  const [host, setHost] = useState<hostType | null>(null); // Track host data
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const [errorMessage, setErrorMessage] = useState<string>(""); // Track errors

  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [shouldCallOnSync, setShouldCallOnSync] = useState(false);

  const [showAddPane, setShowAddPane] = useState<"guest" | "room" | null>(null);
  const [guestErrorMessage, setGuestErrorMessage] = useState("");
  const [roomErrorMessage, setRoomErrorMessage] = useState("");
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
  const [isManageGuestOpen, setIsManageGuestOpen] = useState(false);
  const [isCleanersOpen, setIsCleanersOpen] = useState(false);
  const [isMiscOpen, setIsMiscOpen] = useState(false);
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  // Weeks-per-page on a narrow phone — set from the calendar header, persisted
  // per device so each phone/tablet keeps its own value. Clamped 1–6: 1 is a
  // single-week view, and 6 is the most week-rows any month can span (31 days
  // starting Saturday), so it means "the whole month, never split".
  //
  // A stored 7 or 8 from the old stepper clamps to 6 rather than being thrown
  // away — same result, since anything at or above 6 was already a whole month.
  const clampRows = (n: number) => Math.min(6, Math.max(1, n));
  const [rowsPerPage, setRowsPerPageState] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("calendarRowsPerPage") || "4", 10);
    return Number.isFinite(v) ? clampRows(v) : 4;
  });
  const setRowsPerPage = (n: number) => {
    const clamped = clampRows(n);
    setRowsPerPageState(clamped);
    localStorage.setItem("calendarRowsPerPage", String(clamped));
  };

  // Lane height in px. Clamped rather than trusted: it drives how many week-rows
  // fit a page, so a bad stored value would leave the calendar unusable with no
  // obvious way back.
  const clampRowHeight = (n: number) => Math.min(48, Math.max(16, n));
  const [rowHeight, setRowHeightState] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("calendarRowHeight") || "26", 10);
    return Number.isFinite(v) ? clampRowHeight(v) : 26;
  });
  const setRowHeight = (n: number) => {
    const clamped = clampRowHeight(n);
    setRowHeightState(clamped);
    localStorage.setItem("calendarRowHeight", String(clamped));
  };

  const [currentGuest, setCurrentGuest] = useState<string | null>(null);
  const [currentAirBnBGuest, setCurrentAirBnBGuest] = useState<string | null>(
    null,
  );

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Contact info is on by default, on every calendar, filtered or not. It used
  // to appear only once a guest or room filter was applied, which made the house
  // phone and licence feel like something belonging to a filtered view rather
  // than to the property. The dropdown's Show/Hide Contact Info still governs it.
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(true);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isAvailabilitiesModalOpen, setIsAvailabilitiesModalOpen] =
    useState(false);
  const [isBlockAirBnBModalOpen, setIsBlockAirBnBModalOpen] = useState(false);
  const [isBlockRoomsModalOpen, setIsBlockRoomsModalOpen] = useState(false);
  const [airbnbPendingCount, setAirbnbPendingCount] = useState(0);
  const [availableNightsCount, setAvailableNightsCount] = useState(0);
  const [todoCleanCount, setTodoCleanCount] = useState(0);
  // Finished cleanings still needing hours logged — the Clean button badge
  const [cleanTodoCount, setCleanTodoCount] = useState(0);
  // Upcoming forecast cleanings with no cleaner assigned — 2nd Clean badge
  const [cleanUnassignedCount, setCleanUnassignedCount] = useState(0);
  // House expenses logged for the month in view — the Misc badge on Money
  const [miscCount, setMiscCount] = useState(0);
  const [isRequestManagerOpen, setIsRequestManagerOpen] = useState(false);
  const [bookingRequestPendingCount, setBookingRequestPendingCount] =
    useState(0);
  const [wishListAvailableCount, setWishListAvailableCount] = useState(0);

  const [airBnBInfo, setAirBnBInfo] = useState({
    doorCode: "",
    airbnbName: "",
    airbnbAddress: "",
    airbnbRating: "" as number | "",
    airbnbReviewCount: "" as number | "",
    airbnbReviewsUrl: "",
    airbnbProfileUrl: "",
    cohostProfileUrl: "",
    airbnbSuperhost: false,
    highlights: "",
    houseRules: "",
    cleaningRules: "",
    phone: "",
    contactEmail: "",
    licenseNumber: "",
    cancellationFullRefundDays: "" as number | "",
    cancellationHalfRefundDays: "" as number | "",
  });

  const navigate = useNavigate();

  // Initial data fetching to populate host
  useEffect(() => {
    if (!token) {
      navigate("/login"); // Redirect to login if no token
      return;
    }

    const hostId = getHost() as string;

    setIsLoading(true); // Start loading
    fetchHost(hostId, token as string)
      .then((result) => {
        setHost({ ...result, id: hostId });
        setAirBnBInfo({
          doorCode: result.doorCode ?? "",
          airbnbName: result.airbnbName ?? "",
          airbnbAddress: result.airbnbAddress ?? "",
          airbnbRating: result.airbnbRating ?? "",
          airbnbReviewCount: result.airbnbReviewCount ?? "",
          airbnbReviewsUrl: result.airbnbReviewsUrl ?? "",
          airbnbProfileUrl: result.airbnbProfileUrl ?? "",
          cohostProfileUrl: result.cohostProfileUrls?.[0] ?? "",
          airbnbSuperhost: result.airbnbSuperhost ?? false,
          highlights: (result.highlights ?? []).join(", "),
          houseRules: result.houseRules ?? "",
          cleaningRules: result.cleaningRules ?? "",
          phone: result.phone ?? "",
          contactEmail: result.contactEmail ?? "",
          licenseNumber: result.licenseNumber ?? "",
          cancellationFullRefundDays: result.cancellationFullRefundDays ?? "",
          cancellationHalfRefundDays: result.cancellationHalfRefundDays ?? "",
        });
        setIsLoading(false); // Data fetched, stop loading
      })
      .catch((err) => {
        console.error("Error fetching host:", err);
        setErrorMessage("Failed to fetch host data. Please try again.");
        setIsLoading(false); // Stop loading even on error
      });
  }, [token]);

  if (isLoading) {
    // Render loading screen
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  if (errorMessage) {
    // Render error message
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {errorMessage}
      </div>
    );
  }

  const handleLogout = () => {
    // Clears the refresh token too — otherwise "log out" would leave behind the
    // credential that silently signs you back in.
    clearSession();
    setToken(null);
    setShowLogoutConfirm(false);
  };

  // Render the host data once it's fetched
  return (
    host && (
      <>
      <GuestModeContext.Provider
        value={{
          currentGuest,
          setCurrentGuest,
          currentAirBnBGuest,
          setCurrentAirBnBGuest,
        }}
      >
        <FooterContext.Provider
          value={{
            isFooterVisible,
            setIsFooterVisible,
            phone: airBnBInfo.phone,
            contactEmail: airBnBInfo.contactEmail,
            licenseNumber: airBnBInfo.licenseNumber,
            airbnbAddress: airBnBInfo.airbnbAddress,
          }}
        >
          <isSyncModalOpenContext.Provider
            value={{
              isSyncModalOpen,
              setIsSyncModalOpen,
              shouldCallOnSync,
              setShouldCallOnSync,
            }}
          >
            <AddPaneContext.Provider
              value={{
                showAddPane,
                setShowAddPane,
                guestErrorMessage,
                setGuestErrorMessage,
                roomErrorMessage,
                setRoomErrorMessage,
                isEditRoomOpen,
                setIsEditRoomOpen,
                isManageGuestOpen,
                setIsManageGuestOpen,
                isCleanersOpen,
                setIsCleanersOpen,
                isMiscOpen,
                setIsMiscOpen,
                isRatesOpen,
                setIsRatesOpen,
                rowsPerPage,
                setRowsPerPage,
                rowHeight,
                setRowHeight,
              }}
            >
              {/* Use the DYNAMIC viewport height on mobile: plain 100vh (h-screen)
                  counts the area behind the browser's collapsible toolbars, so the
                  calendar was measured taller than the visible screen and its last
                  week row hid below the browser chrome. 100dvh tracks the actually
                  visible height, so pagination fits the real screen. h-screen stays
                  as the fallback for any browser without dvh support. */}
              <div className="grid grid-rows-[80px_1fr] h-screen supports-[height:100dvh]:h-[100dvh] lg:grid-rows-[120px_1fr]">
                {/* Navbar */}
                <NavBarDesktop
                  handleLogout={() => setShowLogoutConfirm(true)}
                  name={getCohostName() ?? host?.name}
                  setIsAboutModalOpen={setIsAboutModalOpen}
                  airBnBInfo={airBnBInfo}
                  onAirBnBInfoSaved={setAirBnBInfo}
                  isFooterVisible={isFooterVisible}
                  onToggleFooter={() => setIsFooterVisible((v) => !v)}
                  isTodoModalOpen={isTodoModalOpen}
                  setIsTodoModalOpen={setIsTodoModalOpen}
                  isBookModalOpen={isBookModalOpen}
                  setIsBookModalOpen={setIsBookModalOpen}
                  isCleanersOpen={isCleanersOpen}
                  setIsCleanersOpen={setIsCleanersOpen}
                  isMiscOpen={isMiscOpen}
                  setIsMiscOpen={setIsMiscOpen}
                  isRatesOpen={isRatesOpen}
                  setIsRatesOpen={setIsRatesOpen}
                  isAvailabilitiesModalOpen={isAvailabilitiesModalOpen}
                  setIsAvailabilitiesModalOpen={setIsAvailabilitiesModalOpen}
                  isBlockAirBnBModalOpen={isBlockAirBnBModalOpen}
                  setIsBlockAirBnBModalOpen={setIsBlockAirBnBModalOpen}
                  isBlockRoomsModalOpen={isBlockRoomsModalOpen}
                  setIsBlockRoomsModalOpen={setIsBlockRoomsModalOpen}
                  airbnbPendingCount={airbnbPendingCount}
                  availableNightsCount={availableNightsCount}
                  todoCleanCount={todoCleanCount}
                  cleanTodoCount={cleanTodoCount}
                  cleanUnassignedCount={cleanUnassignedCount}
                  miscCount={miscCount}
                  isRequestManagerOpen={isRequestManagerOpen}
                  setIsRequestManagerOpen={setIsRequestManagerOpen}
                  bookingRequestPendingCount={bookingRequestPendingCount}
                  wishListAvailableCount={wishListAvailableCount}
                />

                {/* About Modal */}
                {isAboutModalOpen && (
                  <About setIsAboutModalOpen={setIsAboutModalOpen} />
                )}

                {/* Content */}
                <div className="overflow-hidden grid grid-cols-5 grid-rows-1 min-h-0">
                  <MainView
                    senderName={getCohostName() ?? host?.name ?? ""}
                    calendarId={host.calendar}
                    hostId={host.id}
                    airbnbsync={host.airbnbsync}
                    doorCode={airBnBInfo.doorCode}
                    airbnbName={airBnBInfo.airbnbName}
                    airbnbAddress={airBnBInfo.airbnbAddress}
                    houseRules={airBnBInfo.houseRules}
                    cleaningRules={airBnBInfo.cleaningRules}
                    isTodoModalOpen={isTodoModalOpen}
                    setIsTodoModalOpen={setIsTodoModalOpen}
                    isModalOpen={isBookModalOpen}
                    setIsModalOpen={setIsBookModalOpen}
                    isAvailabilitiesModalOpen={isAvailabilitiesModalOpen}
                    setIsAvailabilitiesModalOpen={setIsAvailabilitiesModalOpen}
                    isBlockAirBnBModalOpen={isBlockAirBnBModalOpen}
                    setIsBlockAirBnBModalOpen={setIsBlockAirBnBModalOpen}
                    isBlockRoomsModalOpen={isBlockRoomsModalOpen}
                    setIsBlockRoomsModalOpen={setIsBlockRoomsModalOpen}
                    setAirbnbPendingCount={setAirbnbPendingCount}
                    setAvailableNightsCount={setAvailableNightsCount}
                    setMiscCount={setMiscCount}
                    setTodoCleanCount={setTodoCleanCount}
                    setCleanTodoCount={setCleanTodoCount}
                    setCleanUnassignedCount={setCleanUnassignedCount}
                    isRequestManagerOpen={isRequestManagerOpen}
                    setIsRequestManagerOpen={setIsRequestManagerOpen}
                    setBookingRequestPendingCount={
                      setBookingRequestPendingCount
                    }
                    setWishListAvailableCount={setWishListAvailableCount}
                    cancellationFullRefundDays={airBnBInfo.cancellationFullRefundDays === "" ? undefined : airBnBInfo.cancellationFullRefundDays}
                    cancellationHalfRefundDays={airBnBInfo.cancellationHalfRefundDays === "" ? undefined : airBnBInfo.cancellationHalfRefundDays}
                  ></MainView>
                </div>
              </div>
            </AddPaneContext.Provider>
          </isSyncModalOpenContext.Provider>
        </FooterContext.Provider>
      </GuestModeContext.Provider>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 flex flex-col gap-5 w-80">
            <div className="flex flex-col gap-1.5">
              <span className="text-xl font-bold text-gray-900">Log out?</span>
              <span className="text-base text-gray-500">You'll need to sign in again to access TiMag.</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-base font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-base font-semibold transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    )
  );
}

export default App;
