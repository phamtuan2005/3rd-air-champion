import { createContext, useContext, useState, ReactNode } from "react";

export type ThemeName = "green" | "amber" | "teal" | "rose" | "indigo";

export interface TiBookTheme {
  name: ThemeName;
  dot: string;
  // Solid buttons & bars
  btn: string;
  btnHover: string;
  btnActive: string;
  // Text links / available date numbers
  textPrimary: string;
  textPrimaryDark: string;
  // Card / tag backgrounds
  tagBg: string;
  tagBorder: string;
  tagText: string;
  // Selected borders / rings
  selectedBorder: string;
  selectedShadow: string;
  // Focus ring
  focusRing: string;
  // Review button text (white bg)
  reviewText: string;
  // Calendar tile soft hover
  tileHover: string;
  tileActive: string;
  // Success / light accent background
  successBg: string;
}

const themes: Record<ThemeName, TiBookTheme> = {
  green: {
    name: "green",
    dot: "bg-green-500",
    btn: "bg-green-500",
    btnHover: "hover:bg-green-600",
    btnActive: "active:bg-green-700",
    textPrimary: "text-green-600",
    textPrimaryDark: "text-green-700",
    tagBg: "bg-green-50",
    tagBorder: "border-green-100",
    tagText: "text-green-700",
    selectedBorder: "border-green-500",
    selectedShadow: "shadow-green-100",
    focusRing: "focus:ring-green-300",
    reviewText: "text-green-600",
    tileHover: "hover:bg-green-50",
    tileActive: "active:bg-green-100",
    successBg: "bg-green-100",
  },
  amber: {
    name: "amber",
    dot: "bg-amber-500",
    btn: "bg-amber-500",
    btnHover: "hover:bg-amber-600",
    btnActive: "active:bg-amber-700",
    textPrimary: "text-amber-600",
    textPrimaryDark: "text-amber-700",
    tagBg: "bg-amber-50",
    tagBorder: "border-amber-100",
    tagText: "text-amber-700",
    selectedBorder: "border-amber-500",
    selectedShadow: "shadow-amber-100",
    focusRing: "focus:ring-amber-300",
    reviewText: "text-amber-600",
    tileHover: "hover:bg-amber-50",
    tileActive: "active:bg-amber-100",
    successBg: "bg-amber-100",
  },
  teal: {
    name: "teal",
    dot: "bg-teal-500",
    btn: "bg-teal-500",
    btnHover: "hover:bg-teal-600",
    btnActive: "active:bg-teal-700",
    textPrimary: "text-teal-600",
    textPrimaryDark: "text-teal-700",
    tagBg: "bg-teal-50",
    tagBorder: "border-teal-100",
    tagText: "text-teal-700",
    selectedBorder: "border-teal-500",
    selectedShadow: "shadow-teal-100",
    focusRing: "focus:ring-teal-300",
    reviewText: "text-teal-600",
    tileHover: "hover:bg-teal-50",
    tileActive: "active:bg-teal-100",
    successBg: "bg-teal-100",
  },
  rose: {
    name: "rose",
    dot: "bg-rose-500",
    btn: "bg-rose-500",
    btnHover: "hover:bg-rose-600",
    btnActive: "active:bg-rose-700",
    textPrimary: "text-rose-600",
    textPrimaryDark: "text-rose-700",
    tagBg: "bg-rose-50",
    tagBorder: "border-rose-100",
    tagText: "text-rose-700",
    selectedBorder: "border-rose-500",
    selectedShadow: "shadow-rose-100",
    focusRing: "focus:ring-rose-300",
    reviewText: "text-rose-600",
    tileHover: "hover:bg-rose-50",
    tileActive: "active:bg-rose-100",
    successBg: "bg-rose-100",
  },
  indigo: {
    name: "indigo",
    dot: "bg-indigo-500",
    btn: "bg-indigo-500",
    btnHover: "hover:bg-indigo-600",
    btnActive: "active:bg-indigo-700",
    textPrimary: "text-indigo-600",
    textPrimaryDark: "text-indigo-700",
    tagBg: "bg-indigo-50",
    tagBorder: "border-indigo-100",
    tagText: "text-indigo-700",
    selectedBorder: "border-indigo-500",
    selectedShadow: "shadow-indigo-100",
    focusRing: "focus:ring-indigo-300",
    reviewText: "text-indigo-600",
    tileHover: "hover:bg-indigo-50",
    tileActive: "active:bg-indigo-100",
    successBg: "bg-indigo-100",
  },
};

interface TiBookThemeContextValue {
  theme: TiBookTheme;
  setTheme: (name: ThemeName) => void;
  allThemes: TiBookTheme[];
}

const TiBookThemeContext = createContext<TiBookThemeContextValue>({
  theme: themes.green,
  setTheme: () => {},
  allThemes: Object.values(themes),
});

const STORAGE_KEY = "tiBookTheme";

export const TiBookThemeProvider = ({ children }: { children: ReactNode }) => {
  const saved = (localStorage.getItem(STORAGE_KEY) as ThemeName) || "green";
  const [themeName, setThemeName] = useState<ThemeName>(
    Object.keys(themes).includes(saved) ? saved : "green"
  );

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  return (
    <TiBookThemeContext.Provider
      value={{ theme: themes[themeName], setTheme, allThemes: Object.values(themes) }}
    >
      {children}
    </TiBookThemeContext.Provider>
  );
};

export const useTiBookTheme = () => useContext(TiBookThemeContext);