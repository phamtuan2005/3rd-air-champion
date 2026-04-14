import { useEffect, useState } from "react";
import { fetchHost, getHost } from "./util/hostOperations";
import { hostType } from "./util/types/hostType";
import { useNavigate } from "react-router";
import NavBarDesktop from "./components/destkop/NavBar/NavBarDesktop";
import MainView from "./components/destkop/MainView/MainView";
import About from "./components/About";
import Footer from "./components/destkop/Footer/Footer";
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
  const [airBnBInfo, setAirBnBInfo] = useState({
    doorCode: "",
    airbnbName: "",
    airbnbAddress: "",
    houseRules: "",
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
          <FooterContext.Provider
            value={{
              isFooterVisible,
              setIsFooterVisible,
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
              />

              {/* About Modal */}
              {isAboutModalOpen && (
                <About setIsAboutModalOpen={setIsAboutModalOpen} />
              )}

              {/* Main Content Area */}
              <div className="grid grid-cols-5 overflow-hidden">
                <MainView
                  calendarId={host.calendar}
                  hostId={host.id}
                  airbnbsync={host.airbnbsync}
                  doorCode={airBnBInfo.doorCode}
                  airbnbName={airBnBInfo.airbnbName}
                  airbnbAddress={airBnBInfo.airbnbAddress}
                ></MainView>
              </div>

              <Footer />
            </div>
          </FooterContext.Provider>
        </AddPaneContext.Provider>
      </isSyncModalOpenContext.Provider>
    )
  );
}

export default App;
