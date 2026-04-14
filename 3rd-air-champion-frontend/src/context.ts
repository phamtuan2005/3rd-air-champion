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
}

interface FooterContextType {
  isFooterVisible: boolean;
  setIsFooterVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const isSyncModalOpenContext = createContext<SyncModalContextType | null>(null);
export const AddPaneContext = createContext<AddPaneContextType | null>(null);
export const FooterContext = createContext<FooterContextType | null>(null);