import { useContext } from "react";
import { FaDatabase, FaDoorOpen, FaSync, FaUser } from "react-icons/fa";
import { TiUserAdd } from "react-icons/ti";
import { MdBedroomParent, MdOutlineMessage } from "react-icons/md";
import { MdEditNote } from "react-icons/md";
import { ImExit } from "react-icons/im";
import AirBnBSyncButton from "./AirBnBSyncButton";
import LogoutButton from "./LogoutButton";
import RoomSyncButton from "./RoomSyncButton";
import AddGuestButton from "./AddGuestButton";
import AddRoomButton from "./AddRoomButton";
import ReminderTemplateButton from "./ReminderTemplateButton";
import { AddPaneContext } from "../../../../App";

interface DropDownMenuProps {
  user: string;
  handleLogout: () => void;
  setIsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenReminderTemplate: () => void;
  onOpenDoorCode: () => void;
}

const DropDownMenu = ({
  user,
  handleLogout,
  setIsDropdownOpen,
  onOpenReminderTemplate,
  onOpenDoorCode,
}: DropDownMenuProps) => {
  const { setIsEditRoomOpen } = useContext(AddPaneContext)!;

  return (
    <div className="absolute left-0 min-w-[160px] w-full bg-white rounded-md grid grid-rows-5 drop-shadow-md">
      {/* Options */}
      <div className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]">
        <div className="basis-1/5 flex w-full items-center justify-center">
          <FaUser />
        </div>
        <div className="basis-4/5 py-1 px-2">{user}</div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => setIsDropdownOpen(false)}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <TiUserAdd />
        </div>
        <div className="basis-4/5">
          <AddGuestButton />
        </div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => setIsDropdownOpen(false)}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <MdBedroomParent />
        </div>
        <div className="basis-4/5">
          <AddRoomButton />
        </div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => {
          setIsDropdownOpen(false);
          setIsEditRoomOpen(true);
        }}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <MdEditNote />
        </div>
        <div className="basis-4/5 py-1 px-2">Edit Room</div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => setIsDropdownOpen(false)}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <FaSync />
        </div>
        <div className="basis-4/5">
          <AirBnBSyncButton />
        </div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => setIsDropdownOpen(false)}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <FaDatabase />
        </div>
        <div className="basis-4/5">
          <RoomSyncButton />
        </div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => {
          setIsDropdownOpen(false);
          onOpenReminderTemplate();
        }}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <MdOutlineMessage />
        </div>
        <div className="basis-4/5">
          <ReminderTemplateButton onOpen={onOpenReminderTemplate} />
        </div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => {
          setIsDropdownOpen(false);
          onOpenDoorCode();
        }}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <FaDoorOpen />
        </div>
        <div className="basis-4/5 py-1 px-2">Door Code</div>
      </div>
      <div
        className="flex items-center border-b border-solid w-full hover:bg-[#D9D9D9]"
        onClick={() => setIsDropdownOpen(false)}
      >
        <div className="basis-1/5 flex w-full items-center justify-center">
          <ImExit />
        </div>
        <div className="basis-4/5">
          <LogoutButton handleLogout={handleLogout} />
        </div>
      </div>
    </div>
  );
};

export default DropDownMenu;