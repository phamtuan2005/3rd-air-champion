const DEFAULT_TEMPLATE =
  "Hello {{name}}, I would like to remind you that you will stay at TT house AirBnB for {{duration}} {{nightWord}}, starting tomorrow ({{startDate}}). Your room is {{room}} {{roomCode}}. The main entrance door code is {{doorCode}}. Many thanks for staying at TT House. I wish you a pleasant stay!";

export const TEMPLATE_KEY = "reminderMessageTemplate";

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

export { DEFAULT_TEMPLATE };
export default ReminderTemplateButton;
