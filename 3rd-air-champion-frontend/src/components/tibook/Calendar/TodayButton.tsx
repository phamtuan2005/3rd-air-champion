import { useTiBookTheme } from "../../../contexts/TiBookThemeContext";

interface TodayButtonProps {
  isCurrentMonth: boolean;
  onScrollToToday?: () => void;
}

const TodayButton = ({ isCurrentMonth, onScrollToToday }: TodayButtonProps) => {
  const { theme } = useTiBookTheme();
  return (
    <button
      onClick={() => onScrollToToday?.()}
      disabled={isCurrentMonth}
      /* The live state was a hardcoded blue — the one accent on this bar that
         ignored the guest's palette, and once the bar can go dark, blue-500 on
         near-black is the hardest thing here to read. Both states come off the
         chrome now, so it stays legible on white and on black. */
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        isCurrentMonth
          ? `${theme.chromeMuted} ${theme.chromeBorder} cursor-default opacity-50`
          : `${theme.chromeAccent} ${theme.chromeBorder} ${theme.chromeHover} cursor-pointer`
      }`}
    >
      Today
    </button>
  );
};

export default TodayButton;
