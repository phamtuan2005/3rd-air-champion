import { createContext } from "react";

interface SyncModalContextType {
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shouldCallOnSync: boolean;
  setShouldCallOnSync: React.Dispatch<React.SetStateAction<boolean>>;
}

interface AddPaneContextType {
  showAddPane: "guest" | "room" | null;
  setShowAddPane: React.Dispatch<React.SetStateAction<"guest" | "room" | null>>;
  guestErrorMessage: string;
  setGuestErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  roomErrorMessage: string;
  setRoomErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  isEditRoomOpen: boolean;
  setIsEditRoomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isManageGuestOpen: boolean;
  setIsManageGuestOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCleanersOpen: boolean;
  setIsCleanersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMiscOpen: boolean;
  isChargesOpen: boolean;
  setIsChargesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMiscOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRatesOpen: boolean;
  setIsRatesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStaffingOpen: boolean;
  setIsStaffingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isUrgentActionOpen: boolean;
  setIsUrgentActionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAskTiMagOpen: boolean;
  setIsAskTiMagOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Weeks-per-page on a narrow phone — a per-device setting tuned from the menu.
  rowsPerPage: number;
  setRowsPerPage: (n: number) => void;
  // Height of one room's lane, in px. Per-device like rowsPerPage: the phone
  // held at arm's length and the desktop monitor want different answers.
  rowHeight: number;
  setRowHeight: (n: number) => void;
}

interface FooterContextType {
  isFooterVisible: boolean;
  setIsFooterVisible: React.Dispatch<React.SetStateAction<boolean>>;
  phone: string;
  contactEmail: string;
  licenseNumber: string;
  airbnbAddress: string;
}

interface GuestModeContextType {
  currentGuest: string | null;
  setCurrentGuest: React.Dispatch<React.SetStateAction<string | null>>;
  currentAirBnBGuest: string | null;
  setCurrentAirBnBGuest: React.Dispatch<React.SetStateAction<string | null>>;
}

export const isSyncModalOpenContext = createContext<SyncModalContextType | null>(null);
export const AddPaneContext = createContext<AddPaneContextType | null>(null);
export const FooterContext = createContext<FooterContextType | null>(null);
export const GuestModeContext = createContext<GuestModeContextType | null>(null);