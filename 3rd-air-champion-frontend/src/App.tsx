import { createContext, useEffect, useState } from "react";
import { fetchHost, getHost } from "./util/hostOperations";
import { hostType } from "./util/types/hostType";
import { useNavigate } from "react-router";
import NavBarDesktop from "./components/destkop/NavBar/NavBarDesktop";
import MainView from "./components/destkop/MainView/MainView";
import About from "./components/About";
import Footer from "./components/destkop/Footer/Footer";
import MessageTemplate from "./components/MessageTemplate";

interface SyncModalContextType {
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shouldCallOnSync: boolean;
  setShouldCallOnSync: React.Dispatch<React.SetStateAction<boolean>>;
}

interface AddPaneContextType {
  showMessageTemplatePane: boolean;
  showAddPane: "guest" | "room" | null;
  setShowAddPane: React.Dispatch<React.SetStateAction<"guest" | "room" | null>>;
  setShowMessageTemplatePane: React.Dispatch<React.SetStateAction<boolean>>;
  guestErrorMessage: string;
  setGuestErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  roomErrorMessage: string;
  setRoomErrorMessage: React.Dispatch<React.SetStateAction<string>>;
}

export const isSyncModalOpenContext =
  createContext<SyncModalContextType | null>(null);

export const AddPaneContext = createContext<AddPaneContextType | null>(null);

function App() {
  const [host, setHost] = useState<hostType | null>(null); // Track host data
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const [errorMessage, setErrorMessage] = useState<string>(""); // Track errors

  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);


  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [shouldCallOnSync, setShouldCallOnSync] = useState(false);

  const [showAddPane, setShowAddPane] = useState<"guest" | "room" | null>(null);
  const [showMessageTemplatePane, setShowMessageTemplatePane] = useState(false);
  
  const [guestErrorMessage, setGuestErrorMessage] = useState("");
  const [roomErrorMessage, setRoomErrorMessage] = useState("");

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
            showMessageTemplatePane,
            setShowAddPane,
            setShowMessageTemplatePane,
            guestErrorMessage,
            setGuestErrorMessage,
            roomErrorMessage,
            setRoomErrorMessage,
          }}
        >
          <div className="grid grid-rows-[80px_1fr] h-screen lg:grid-rows-[120px_1fr]">
            {/* Navbar */}
            <NavBarDesktop
              handleLogout={handleLogout}
              name={host?.name}
              setIsAboutModalOpen={setIsAboutModalOpen}
            />

            {/* About Modal */}
            {isAboutModalOpen && (
              <About setIsAboutModalOpen={setIsAboutModalOpen} />
            )}

            {showMessageTemplatePane && (
            <MessageTemplate setIsMessageTemplateModalOpen={setShowMessageTemplatePane}/> 
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-5 overflow-hidden">
              <MainView
                calendarId={host.calendar}
                hostId={host.id}
                airbnbsync={host.airbnbsync}
              ></MainView>
            </div>

            <Footer />
          </div>
        </AddPaneContext.Provider>
      </isSyncModalOpenContext.Provider>
    )
  );
}

export default App;
