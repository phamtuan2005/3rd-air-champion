import { useContext } from "react";
import { AddPaneContext } from "../../../../context";

const AddGuestButton = () => {
  const { setIsManageGuestOpen } = useContext(AddPaneContext) as {
    setIsManageGuestOpen: React.Dispatch<React.SetStateAction<boolean>>;
  };

  return (
    <button
      className="py-1 px-2"
      onClick={() => setIsManageGuestOpen(true)}
    >
      Guest
    </button>
  );
};

export default AddGuestButton;