import { useState } from "react";
import DropDownMenu from "./DropDown/DropDownMenu";
import ReminderTemplateModal from "./DropDown/ReminderTemplateModal";
import BookingTemplateModal from "./DropDown/BookingTemplateModal";
import TemplatePickerModal from "./DropDown/TemplatePickerModal";
import MyAirBnBModal from "./DropDown/MyAirBnBModal";

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

interface ProfileDesktopProps {
  handleLogout: () => void;
  children: string;
  name: string;
  airBnBInfo: AirBnBInfo;
  onAirBnBInfoSaved: (info: AirBnBInfo) => void;
  isFooterVisible: boolean;
  onToggleFooter: () => void;
}

const ProfileDesktop = ({
  children,
  handleLogout,
  name,
  airBnBInfo,
  onAirBnBInfoSaved,
  isFooterVisible,
  onToggleFooter,
}: ProfileDesktopProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isReminderTemplateOpen, setIsReminderTemplateOpen] = useState(false);
  const [isBookingTemplateOpen, setIsBookingTemplateOpen] = useState(false);
  const [isMyAirBnBOpen, setIsMyAirBnBOpen] = useState(false);

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  console.log(name);

  return (
    <div>
      <div
        className="flex items-center cursor-pointer space-x-2"
        onClick={toggleDropdown}
      >
        {/* Parent Container for Profile and Tick */}
        <div
          className="h-[44px] w-[44px] sm:h-[76px] sm:w-[76px] relative flex items-center justify-center"
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

        <span className="hidden sm:inline text-[1.25rem]">
          {children}
        </span>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <DropDownMenu
          user={children}
          handleLogout={handleLogout}
          setIsDropdownOpen={setIsDropdownOpen}
          onOpenReminderTemplate={() => setIsTemplatePickerOpen(true)}
          onOpenMyAirBnB={() => setIsMyAirBnBOpen(true)}
          isFooterVisible={isFooterVisible}
          onToggleFooter={onToggleFooter}
        />
      )}

      {/* Template Picker Modal */}
      {isTemplatePickerOpen && (
        <TemplatePickerModal
          onClose={() => setIsTemplatePickerOpen(false)}
          onOpenReminderTemplate={() => setIsReminderTemplateOpen(true)}
          onOpenBookingTemplate={() => setIsBookingTemplateOpen(true)}
        />
      )}

      {/* Reminder Template Modal */}
      {isReminderTemplateOpen && (
        <ReminderTemplateModal onClose={() => setIsReminderTemplateOpen(false)} />
      )}

      {/* Booking Template Modal */}
      {isBookingTemplateOpen && (
        <BookingTemplateModal onClose={() => setIsBookingTemplateOpen(false)} />
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
