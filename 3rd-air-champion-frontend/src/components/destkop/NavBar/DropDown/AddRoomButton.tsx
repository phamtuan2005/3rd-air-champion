import { useContext } from "react";
import { AddPaneContext } from "../../../../context";

const AddRoomButton = () => {
  const context = useContext(AddPaneContext) as {
    setShowAddPane: React.Dispatch<
      React.SetStateAction<"guest" | "room" | null>
    >;
  };

  const { setShowAddPane } = context;

  return (
    <button
      className="py-1 px-2"
      onClick={() => {
        setShowAddPane("room");
      }}
    >
      Add Room
    </button>
  );
};

export default AddRoomButton;
