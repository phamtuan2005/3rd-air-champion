import { useContext } from "react";
import { isSyncModalOpenContext } from "../../../../context";

const RoomSyncButton = () => {
  const context = useContext(isSyncModalOpenContext) as {
    isSyncModalOpen: boolean;
    setIsSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  };

  const { setIsSyncModalOpen } = context;

  return (
    <button onClick={() => setIsSyncModalOpen(true)} className="px-2 py-1">
      Link AirBnB
    </button>
  );
};

export default RoomSyncButton;
