import TemplateEditorModal, { TemplatePlaceholder } from "../../../shared/TemplateEditorModal";
import { BOOKING_TEMPLATE_KEY, DEFAULT_BOOKING_TEMPLATE } from "../../../../util/bookingTemplate";

interface BookingTemplateModalProps {
  onClose: () => void;
}

// The tokens the booking confirmation understands, each with what the preview
// shows for it. The samples are a made-up two-night stay, not a real guest.
const PLACEHOLDERS: TemplatePlaceholder[] = [
  { label: "Name", value: "{{name}}", sample: "Susan" },
  { label: "Duration", value: "{{duration}}", sample: "2" },
  { label: "Night word", value: "{{nightWord}}", sample: "nights" },
  { label: "Start date", value: "{{startDate}}", sample: "Mon, Oct 19" },
  { label: "End date", value: "{{endDate}}", sample: "Wed, Oct 21" },
  { label: "Room", value: "{{room}}", sample: "King" },
  { label: "Room code", value: "{{roomCode}}", sample: "1224#" },
  { label: "Door code", value: "{{doorCode}}", sample: "4321" },
  { label: "Price", value: "{{price}}", sample: "150" },
  { label: "AirBnB name", value: "{{airBnBName}}", sample: "TT House in Silicon Valley" },
  { label: "AirBnB address", value: "{{airBnBAddress}}", sample: "123 Example St, San Jose" },
];

const BookingTemplateModal = ({ onClose }: BookingTemplateModalProps) => (
  <TemplateEditorModal
    title="Booking template"
    subtitle="The confirmation a guest gets when a stay is booked"
    placeholders={PLACEHOLDERS}
    initial={localStorage.getItem(BOOKING_TEMPLATE_KEY) || DEFAULT_BOOKING_TEMPLATE}
    defaultTemplate={DEFAULT_BOOKING_TEMPLATE}
    onSave={(template) => localStorage.setItem(BOOKING_TEMPLATE_KEY, template)}
    onClose={onClose}
  />
);

export default BookingTemplateModal;
