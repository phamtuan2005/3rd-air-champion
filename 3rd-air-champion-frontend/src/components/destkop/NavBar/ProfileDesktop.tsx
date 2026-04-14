import { useState } from "react";
import DropDownMenu from "./DropDown/DropDownMenu";
import ReminderTemplateModal from "./DropDown/ReminderTemplateModal";
import MyAirBnBModal from "./DropDown/MyAirBnBModal";

interface AirBnBInfo {
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  houseRules: string;
}

interface ProfileDesktopProps {
  handleLogout: () => void;
  children: string;
  name: string;
  airBnBInfo: AirBnBInfo;
  onAirBnBInfoSaved: (info: AirBnBInfo) => void;
}

const ProfileDesktop = ({
  children,
  handleLogout,
  name,
  airBnBInfo,
  onAirBnBInfoSaved,
}: ProfileDesktopProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isReminderTemplateOpen, setIsReminderTemplateOpen] = useState(false);
  const [isMyAirBnBOpen, setIsMyAirBnBOpen] = useState(false);

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  console.log(name);

  return (
    <div className="relative">
      <div
        className="flex items-center cursor-pointer space-x-2"
        onClick={toggleDropdown}
      >
        {/* Parent Container for Profile and Tick */}
        <div
          className={`${
            window.screen.availWidth > 640
              ? "h-[76px] w-[76px]"
              : "h-[44px] w-[44px]"
          } relative flex items-center justify-center`}
        >
          {/* Profile Image Container */}
          <div className="h-full w-full rounded-full border border-solid border-black overflow-hidden">
            <img
              src={`./${name}.jpg`}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Tick Overlay */}
          <div className="absolute bottom-0 right-0 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center border border-white">
            ✓
          </div>
        </div>

        <span
          className={`${
            window.screen.availWidth > 640 ? "text-[1.25rem]" : "hidden"
          }`}
        >
          {children}
        </span>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <DropDownMenu
          user={children}
          handleLogout={handleLogout}
          setIsDropdownOpen={setIsDropdownOpen}
          onOpenReminderTemplate={() => setIsReminderTemplateOpen(true)}
          onOpenMyAirBnB={() => setIsMyAirBnBOpen(true)}
        />
      )}

      {/* Reminder Template Modal — rendered outside dropdown so it persists */}
      {isReminderTemplateOpen && (
        <ReminderTemplateModal onClose={() => setIsReminderTemplateOpen(false)} />
      )}

      {/* My AirBnB Modal */}
      {isMyAirBnBOpen && (
        <MyAirBnBModal
          current={airBnBInfo}
          onClose={() => setIsMyAirBnBOpen(false)}
          onSaved={onAirBnBInfoSaved}
        />
      )}
    </div>
  );
};

export default ProfileDesktop;
