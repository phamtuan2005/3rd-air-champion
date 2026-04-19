import { useEffect, useState } from "react";
import { fetchHost, getHost } from "./util/hostOperations";
import { hostType } from "./util/types/hostType";
import { useNavigate } from "react-router";
import NavBarDesktop from "./components/destkop/NavBar/NavBarDesktop";
import MainView from "./components/destkop/MainView/MainView";
import About from "./components/About";
import { isSyncModalOpenContext, AddPaneContext, FooterContext } from "./context";

function App() {
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

  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(true);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isAvailabilitiesModalOpen, setIsAvailabilitiesModalOpen] = useState(false);
  const [isBlockAirBnBModalOpen, setIsBlockAirBnBModalOpen] = useState(false);
  const [isBlockRoomsModalOpen, setIsBlockRoomsModalOpen] = useState(false);

  const [airBnBInfo, setAirBnBInfo] = useState({
    doorCode: "",
    airbnbName: "",
    airbnbAddress: "",
    houseRules: "",
    phone: "",
    contactEmail: "",
    licenseNumber: "",
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
          houseRules: result.houseRules ?? "",
          phone: result.phone ?? "",
          contactEmail: result.contactEmail ?? "",
          licenseNumber: result.licenseNumber ?? "",
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
    alert("Logged out!");
  };

  // Render the host data once it's fetched
  return (
    host && (
      <FooterContext.Provider value={{ isFooterVisible, setIsFooterVisible, phone: airBnBInfo.phone, contactEmail: airBnBInfo.contactEmail, licenseNumber: airBnBInfo.licenseNumber, airbnbAddress: airBnBInfo.airbnbAddress }}>
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
                handleLogout={handleLogout}
                name={host?.name}
                setIsAboutModalOpen={setIsAboutModalOpen}
                airBnBInfo={airBnBInfo}
                onAirBnBInfoSaved={setAirBnBInfo}
                isFooterVisible={isFooterVisible}
                onToggleFooter={() => setIsFooterVisible(v => !v)}
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
              />

              {/* About Modal */}
              {isAboutModalOpen && (
                <About setIsAboutModalOpen={setIsAboutModalOpen} />
              )}

              {/* Content + Footer */}
              <div className="flex flex-col overflow-hidden">
                {/* Main Content Area */}
                <div className="grid grid-cols-5 flex-1 min-h-0 overflow-hidden">
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
                  ></MainView>
                </div>

                {isFooterVisible && <footer className="bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-2 shrink-0">
                  <div className="container flex flex-col md:flex-row md:justify-between items-center text-xs gap-2">
                    <p className="text-center md:text-left">
                      TT House & Garden is permitted by Milpitas City for STR. License# 45542
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span>(408) 306 2119</span>
                      <span>|</span>
                      <span>phamtuan2005@yahoo.com</span>
                      <span>|</span>
                      <span>1682 Blue Spruce Way, Milpitas, CA 95035</span>
                    </div>
                  </div>
                </footer>}
              </div>
            </div>
        </AddPaneContext.Provider>
      </isSyncModalOpenContext.Provider>
      </FooterContext.Provider>
    )
  );
}

export default App;
