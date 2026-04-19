import ProfileDesktop from "./ProfileDesktop";

interface AirBnBInfo {
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  houseRules: string;
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
  isAvailabilitiesModalOpen: boolean;
  setIsAvailabilitiesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockAirBnBModalOpen: boolean;
  setIsBlockAirBnBModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  isAvailabilitiesModalOpen,
  setIsAvailabilitiesModalOpen,
  isBlockAirBnBModalOpen,
  setIsBlockAirBnBModalOpen,
}: NavBarDesktopProps) => {
  return (
    <div className="px-1 flex items-center justify-between w-full h-[80px] bg-white drop-shadow-md z-50 lg:h-[120px]">
      {/* Profile Section */}
      <div className="">
        <ProfileDesktop handleLogout={handleLogout} name={name} airBnBInfo={airBnBInfo} onAirBnBInfoSaved={onAirBnBInfoSaved} isFooterVisible={isFooterVisible} onToggleFooter={onToggleFooter}>
          {name}
        </ProfileDesktop>
      </div>

      {/* Centered Navigation Buttons */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="p-1 sm:p-2 text-base sm:text-xl font-bold tracking-wide text-gray-800">
          TT House Booking Manager
        </h1>
        <div className="flex gap-1 sm:gap-2">
          <button
            type="button"
            className={`flex-1 text-white bg-black px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md whitespace-nowrap ${
              isTodoModalOpen ? "drop-shadow-[0_4px_6px_rgba(59,130,246,0.5)]" : ""
            }`}
            onClick={() => {
              setIsTodoModalOpen(!isTodoModalOpen);
              setIsAvailabilitiesModalOpen(false);
              setIsBlockAirBnBModalOpen(false);
            }}
          >
            To Do
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
            className={`flex-1 text-white bg-emerald-600 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md ${
              isAvailabilitiesModalOpen ? "drop-shadow-[0_4px_6px_rgba(59,130,246,0.5)]" : ""
            }`}
            onClick={() => {
              setIsAvailabilitiesModalOpen(!isAvailabilitiesModalOpen);
              setIsTodoModalOpen(false);
              setIsBlockAirBnBModalOpen(false);
            }}
          >
            Availabilities
          </button>
          <button
            type="button"
            className={`flex-1 text-white bg-rose-500 px-1 py-1 text-xs sm:flex-none sm:px-2 rounded-md whitespace-nowrap ${
              isBlockAirBnBModalOpen ? "drop-shadow-[0_4px_6px_rgba(244,63,94,0.5)]" : ""
            }`}
            onClick={() => {
              setIsBlockAirBnBModalOpen(!isBlockAirBnBModalOpen);
              setIsTodoModalOpen(false);
              setIsAvailabilitiesModalOpen(false);
            }}
          >
            Block AirBnB
          </button>
        </div>
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
    </div>
  );
};

export default NavBarDesktop;
