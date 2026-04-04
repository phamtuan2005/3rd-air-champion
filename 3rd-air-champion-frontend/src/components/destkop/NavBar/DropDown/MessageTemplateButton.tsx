import { useContext } from "react";
import { AddPaneContext } from "../../../../App";

const MessageTemplateButton = () => {
  const context = useContext(AddPaneContext) as {
    setShowMessageTemplatePane: React.Dispatch<React.SetStateAction<boolean>>;
  };

  const { setShowMessageTemplatePane } = context;

  return (
    <button
      className="py-1 px-2"
      onClick={() => {
        setShowMessageTemplatePane(true);
      }}
    >
      Message Template
    </button>
  );
};

export default MessageTemplateButton;