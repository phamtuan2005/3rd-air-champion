import { useContext } from "react";
import { createPortal } from "react-dom";
import { FaDatabase, FaDoorOpen, FaSync, FaUser, FaEye, FaEyeSlash } from "react-icons/fa";
import { TiUserAdd } from "react-icons/ti";
import { MdOutlineMessage } from "react-icons/md";
import { MdEditNote } from "react-icons/md";
import { ImExit } from "react-icons/im";
import AirBnBSyncButton from "./AirBnBSyncButton";
import LogoutButton from "./LogoutButton";
import RoomSyncButton from "./RoomSyncButton";
import AddGuestButton from "./AddGuestButton";
import ReminderTemplateButton from "./ReminderTemplateButton";
import { AddPaneContext } from "../../../../context";

interface DropDownMenuProps {
  user: string;
  handleLogout: () => void;
  setIsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenReminderTemplate: () => void;
  onOpenMyAirBnB: () => void;
  isFooterVisible: boolean;
  onToggleFooter: () => void;
}

const DropDownMenu = ({
  user,
  handleLogout,
  setIsDropdownOpen,
  onOpenReminderTemplate,
  onOpenMyAirBnB,
  isFooterVisible,
  onToggleFooter,
}: DropDownMenuProps) => {
  const { setIsEditRoomOpen } = useContext(AddPaneContext)!;

  const close = () => setIsDropdownOpen(false);

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]"
      onClick={close}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-72 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-700">
            <FaUser className="text-sm" />
            <span className="font-semibold text-sm">{user}</span>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
            onClick={close}
          >
            &times;
          </button>
        </div>

        {/* Menu items */}
        <ul className="flex flex-col py-1">
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={close}
          >
            <TiUserAdd className="text-base flex-shrink-0" />
            <AddGuestButton />
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={() => { close(); setIsEditRoomOpen(true); }}
          >
            <MdEditNote className="text-base flex-shrink-0" />
            <span>Room</span>
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={close}
          >
            <FaSync className="text-base flex-shrink-0" />
            <AirBnBSyncButton />
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={close}
          >
            <FaDatabase className="text-base flex-shrink-0" />
            <RoomSyncButton />
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={() => { close(); onOpenReminderTemplate(); }}
          >
            <MdOutlineMessage className="text-base flex-shrink-0" />
            <ReminderTemplateButton onOpen={onOpenReminderTemplate} />
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={() => { close(); onOpenMyAirBnB(); }}
          >
            <FaDoorOpen className="text-base flex-shrink-0" />
            <span>My AirBnB</span>
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100"
            onClick={() => { onToggleFooter(); close(); }}
          >
            {isFooterVisible ? <FaEyeSlash className="text-base flex-shrink-0" /> : <FaEye className="text-base flex-shrink-0" />}
            <span>{isFooterVisible ? "Hide Footer" : "Show Footer"}</span>
          </li>
          <li
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-red-500"
            onClick={close}
          >
            <ImExit className="text-base flex-shrink-0" />
            <LogoutButton handleLogout={handleLogout} />
          </li>
        </ul>
      </div>
    </div>,
    document.body
  );
};

export default DropDownMenu;