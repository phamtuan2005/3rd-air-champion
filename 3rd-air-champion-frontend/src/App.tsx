import { useEffect, useState } from "react";
import { fetchHost, getHost, getCohostName } from "./util/hostOperations";
import { hostType } from "./util/types/hostType";
import { useNavigate } from "react-router";
import NavBarDesktop from "./components/destkop/NavBar/NavBarDesktop";
import MainView from "./components/destkop/MainView/MainView";
import About from "./components/About";
import {
  isSyncModalOpenContext,
  AddPaneContext,
  FooterContext,
  GuestModeContext,
} from "./context";

const formatPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1")
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
};

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

  const [currentGuest, setCurrentGuest] = useState<string | null>(null);
  const [currentAirBnBGuest, setCurrentAirBnBGuest] = useState<string | null>(
    null,
  );

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(true);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isAvailabilitiesModalOpen, setIsAvailabilitiesModalOpen] =
    useState(false);
  const [isBlockAirBnBModalOpen, setIsBlockAirBnBModalOpen] = useState(false);
  const [isBlockRoomsModalOpen, setIsBlockRoomsModalOpen] = useState(false);
  const [airbnbPendingCount, setAirbnbPendingCount] = useState(0);
  const [availableNightsCount, setAvailableNightsCount] = useState(0);
  const [todoCleanCount, setTodoCleanCount] = useState(0);
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
    localStorage.removeItem("token");
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
              }}
            >
              <div className="grid grid-rows-[80px_1fr] h-screen lg:grid-rows-[120px_1fr]">
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
                  isAvailabilitiesModalOpen={isAvailabilitiesModalOpen}
                  setIsAvailabilitiesModalOpen={setIsAvailabilitiesModalOpen}
                  isBlockAirBnBModalOpen={isBlockAirBnBModalOpen}
                  setIsBlockAirBnBModalOpen={setIsBlockAirBnBModalOpen}
                  isBlockRoomsModalOpen={isBlockRoomsModalOpen}
                  setIsBlockRoomsModalOpen={setIsBlockRoomsModalOpen}
                  airbnbPendingCount={airbnbPendingCount}
                  availableNightsCount={availableNightsCount}
                  todoCleanCount={todoCleanCount}
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
                    calendarId={host.calendar}
                    hostId={host.id}
                    airbnbsync={host.airbnbsync}
                    doorCode={airBnBInfo.doorCode}
                    airbnbName={airBnBInfo.airbnbName}
                    airbnbAddress={airBnBInfo.airbnbAddress}
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
                    setTodoCleanCount={setTodoCleanCount}
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

                <footer
                  className={`fixed bottom-0 left-0 right-0 z-40 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-2 transition-transform duration-300 ${isFooterVisible ? "translate-y-0" : "translate-y-full"}`}
                >
                  <p className="text-xs text-center leading-relaxed">
                    {airBnBInfo.licenseNumber && (
                      <>
                        {airBnBInfo.airbnbName} is permitted for STR. License#{" "}
                        {airBnBInfo.licenseNumber}
                        {airBnBInfo.phone ||
                        airBnBInfo.contactEmail ||
                        airBnBInfo.airbnbAddress
                          ? "  |  "
                          : ""}
                      </>
                    )}
                    {airBnBInfo.phone && (
                      <>
                        {formatPhone(airBnBInfo.phone)}
                        {airBnBInfo.contactEmail || airBnBInfo.airbnbAddress
                          ? "  |  "
                          : ""}
                      </>
                    )}
                    {airBnBInfo.contactEmail && (
                      <>
                        {airBnBInfo.contactEmail}
                        {airBnBInfo.airbnbAddress ? "  |  " : ""}
                      </>
                    )}
                    {airBnBInfo.airbnbAddress && (
                      <>{airBnBInfo.airbnbAddress.replace("\n", ", ")}</>
                    )}
                  </p>
                </footer>
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
