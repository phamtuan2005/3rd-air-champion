interface ReminderTemplateButtonProps {
  onOpen: () => void;
}

const ReminderTemplateButton = ({ onOpen }: ReminderTemplateButtonProps) => {
  return (
    <button className="py-1 px-2" onClick={onOpen}>
      Reminder Template
    </button>
  );
};

export default ReminderTemplateButton;
