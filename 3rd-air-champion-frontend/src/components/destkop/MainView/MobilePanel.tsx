interface MobilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobilePanel = ({ isOpen, onClose, children }: MobilePanelProps) => (
  <div
    className={`fixed bottom-0 left-0 w-full h-auto bg-white p-1 border-t border-gray-300 z-50 overflow-y-scroll sm:hidden transition-transform duration-300 ${
      isOpen ? "translate-y-0" : "translate-y-full"
    }`}
  >
    <div className="flex justify-center">
      <button
        className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
        onClick={onClose}
      >
        &times;
      </button>
    </div>
    {children}
  </div>
);

export default MobilePanel;