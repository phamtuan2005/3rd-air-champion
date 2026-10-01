import TemplateEditorModal, { TemplatePlaceholder } from "../../../shared/TemplateEditorModal";
import { DEFAULT_TEMPLATE, loadTemplate, saveTemplate } from "../../../../util/reminderTemplate";

interface ReminderTemplateModalProps {
  onClose: () => void;
}

// The tokens the reminder understands, each with what the preview shows for
// it. The samples are a made-up two-night stay, not a real guest.
const PLACEHOLDERS: TemplatePlaceholder[] = [
  { label: "Name", value: "{{name}}", sample: "Susan" },
  { label: "Stay length", value: "{{stayDuration}}", sample: "2 nights, starting tomorrow" },
  { label: "Duration", value: "{{duration}}", sample: "2" },
  { label: "Night word", value: "{{nightWord}}", sample: "nights" },
  { label: "Start date", value: "{{startDate}}", sample: "Mon, Oct 19" },
  { label: "Itinerary (room by room)", value: "{{itinerary}}", sample: "Mon, Oct 19 to Wed, Oct 21: King (room code 1224#)" },
  { label: "Room", value: "{{room}}", sample: "King" },
  { label: "Room code", value: "{{roomCode}}", sample: "1224#" },
  { label: "Door code", value: "{{doorCode}}", sample: "4321" },
  { label: "AirBnB name", value: "{{airBnBName}}", sample: "TT House in Silicon Valley" },
  { label: "AirBnB address", value: "{{airBnBAddress}}", sample: "123 Example St, San Jose" },
  { label: "House rules", value: "{{houseRules}}", sample: "(your house rules appear here)" },
];

const ReminderTemplateModal = ({ onClose }: ReminderTemplateModalProps) => (
  <TemplateEditorModal
    title="Reminder template"
    subtitle="The text a guest gets the day before they arrive"
    placeholders={PLACEHOLDERS}
    initial={loadTemplate().template}
    defaultTemplate={DEFAULT_TEMPLATE}
    // Saved as a template that knows of {{houseRules}}: leaving the token out
    // here is a choice, and the reminder honours it (see resolveTemplate).
    onSave={saveTemplate}
    onClose={onClose}
  />
);

export default ReminderTemplateModal;
