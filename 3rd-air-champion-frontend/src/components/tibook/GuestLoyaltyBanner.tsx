import { useState } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

export interface LoyaltyTier {
  label: string;
  color: string;
  message: (totalStays: number, totalNights: number, memberSince: string | null) => string;
}


const COLLAPSED_KEY = "tiBookWelcomeCollapsed";

export const LOYALTY_TIERS: { minStays: number; tier: LoyaltyTier }[] = [
  {
    minStays: 50,
    tier: {
      label: "Cherished Guest",
      color: "text-amber-700 bg-amber-50 border-amber-200",
      message: () =>
        `You are not just a guest, you are part of the TT House family. ` +
        `We hold every single one of those nights close to our hearts, and your trust in us means everything. Thank you for being so wonderfully you.`,
    },
  },
  {
    minStays: 20,
    tier: {
      label: "Valued Guest",
      color: "text-purple-700 bg-purple-50 border-purple-200",
      message: () =>
        `You have truly made TT House your home away from home. ` +
        `We are so grateful you keep choosing us, and we will always do our best to deserve that trust.`,
    },
  },
  {
    minStays: 5,
    tier: {
      label: "Loyal Guest",
      color: "text-blue-700 bg-blue-50 border-blue-200",
      message: () =>
        `Every time you come back, it genuinely warms our hearts. ` +
        `You are a true friend of TT House, and we look forward to many more stays together.`,
    },
  },
  {
    minStays: 1,
    tier: {
      label: "Returning Guest",
      color: "text-green-700 bg-green-50 border-green-200",
      message: () =>
        `It means so much to have you back! We hope every stay with us feels like a little retreat — ` +
        `comfortable, warm, and just right. See you again soon!`,
    },
  },
];

export const getLoyaltyTier = (totalStays: number): LoyaltyTier | null => {
  const match = LOYALTY_TIERS.find((t) => totalStays >= t.minStays);
  return match?.tier ?? null;
};

interface GuestLoyaltyBannerProps {
  firstName: string;
  totalStays: number;
  totalNights: number;
  memberSince: string | null;
}

const GuestLoyaltyBanner = ({ firstName, totalStays, totalNights, memberSince }: GuestLoyaltyBannerProps) => {
  const { theme } = useTiBookTheme();
  const loyaltyTier = getLoyaltyTier(totalStays);
  // Open the first time — the welcome is the point of this for a returning
  // guest, and starting it shut would greet them with nothing. Once a guest
  // folds it away it stays folded on that device, because somebody who wanted
  // the room back once wants it back every time.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      // A browser that refuses storage still works; it just forgets the choice.
      return false;
    }
  });
  const toggle = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* nothing to do — the fold still works for this visit */
    }
  };

  return (
    <div className={`tibook-type px-4 py-3 rounded-2xl ${theme.tagBg} border ${theme.tagBorder}`}>
      {/* The greeting and the badge always show; the numbers and the message
          fold away.
          This sits above the bookings a guest opened the sheet to read, and in
          the Hero layout — a shorter column — it was pushing them down the
          screen with no way to reclaim the room. Collapsing is remembered per
          device, and it is never a one-way trade: the chevron brings it back,
          the same rule the room banner on the home screen follows. */}
      <button
        type="button"
        onClick={() => toggle(!collapsed)}
        aria-expanded={!collapsed}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <p className={`text-sm font-bold ${theme.textPrimaryDark}`}>
          Hi {firstName}! Welcome back
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          {loyaltyTier && (
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${loyaltyTier.color}`}>
              {loyaltyTier.label}
            </span>
          )}
          <span
            aria-hidden
            className={`${theme.surfaceMuted2} text-[11px] leading-none transition-transform ${
              collapsed ? "" : "rotate-180"
            }`}
          >
            ▾
          </span>
        </span>
      </button>

      {!collapsed && totalStays > 0 && memberSince && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-[11px] font-bold ${theme.textPrimary}`}>
            {totalStays} {totalStays === 1 ? "stay" : "stays"}
          </span>
          <span className={`${theme.dim} text-[10px]`}>·</span>
          <span className={`text-[11px] font-bold ${theme.textPrimary}`}>
            {totalNights} {totalNights === 1 ? "night" : "nights"}
          </span>
          <span className={`${theme.dim} text-[10px]`}>·</span>
          <span className={`text-[11px] ${theme.surfaceMuted2}`}>
            with us since {memberSince}
          </span>
        </div>
      )}

      {!collapsed && (
      <p className={`text-xs ${theme.surfaceMuted} mt-1.5 leading-relaxed`}>
        {loyaltyTier
          ? loyaltyTier.message(totalStays, totalNights, memberSince)
          : "Welcome to TT House! We are so happy you are here, and we hope this stay is the first of many. Your comfort is truly our mission."}
      </p>
      )}
    </div>
  );
};

export default GuestLoyaltyBanner;