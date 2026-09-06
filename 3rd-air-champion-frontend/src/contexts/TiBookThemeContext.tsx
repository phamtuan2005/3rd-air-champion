import { createContext, useContext, useState, ReactNode } from "react";

export type ThemeName = "green" | "amber" | "teal" | "rose" | "indigo";

/*
 * The second axis: which SKIN the accent colour is worn in.
 *
 * "classic" is the TiBook that has always been here — white chrome, one flat
 * accent, quiet corners. "vivid" is the same app in neon: the primary action
 * becomes a gradient, the chrome around the calendar goes dark, corners open
 * up and the accent carries a coloured glow.
 *
 * It is a SKIN, not a second app. Every screen, every flow and every rule is
 * shared — one availability rule, one cart grouping, one reserved-hold path.
 * Two of any of those would eventually disagree, and the guest is the one who
 * would see the disagreement (TIBOOK.md rule 1). So the skin lives here, in
 * the layer components already read their colour from, and no component had to
 * learn which skin it is wearing.
 *
 * The palette choice survives the switch: picking neon does not throw away the
 * guest's green/amber/teal/rose/indigo, it re-renders it. Five palettes times
 * two skins is ten looks, and the swatches keep meaning in both.
 */
export type VibeName = "classic" | "vivid";

export interface TiBookTheme {
  name: ThemeName;
  vibe: VibeName;
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

  /*
   * Chrome — the bars that FRAME the calendar (nav, month strip, action bar),
   * as opposed to the content sitting on them.
   *
   * These are tokens even in classic, where they are just the white bar that
   * was always hardcoded. Naming them is what lets vivid go dark without any
   * component growing an `if (vibe === ...)`.
   *
   * Only the chrome goes dark. The cards and sheets stay light on purpose:
   * their greys and near-blacks are written into the markup in ~130 places,
   * and darkening the surface under them turns a guest's check-in code and
   * their total into grey-on-black. The frame carries the mood; the content
   * stays readable. That is the whole trade, and it is deliberate.
   */
  chrome: string;
  chromeText: string;
  chromeMuted: string;
  chromeBorder: string;
  chromeHover: string;
  // Accent readable ON the chrome — on dark chrome the content accent is too
  // dim to sit on, so it steps up a few hundred rather than being reused.
  chromeAccent: string;
  chromeRing: string;
  // Behind everything, where no panel paints over it.
  backdrop: string;

  /*
   * Surfaces — the browse stack a guest lands on: host banner, house facts,
   * room cards. These follow the chrome into the dark, because they are the
   * first screenful and a dark bar sitting on a white banner reads as a bug
   * rather than as a choice.
   *
   * Where it STOPS is the calendar grid and every modal. Those carry the
   * numbers a guest acts on — the nights that are free, their rate, their
   * total, the door code — and their contrast was tuned against white. The
   * mood is worth the frame and the first screen; it is not worth a door code
   * nobody can read in a hallway at 11pm.
   */
  surface: string;
  surfaceSubtle: string;
  surfaceBorder: string;
  surfaceText: string;
  surfaceMuted: string;

  /*
   * The house-facts band, which is its own thing in both skins: a soft tint of
   * the accent in classic, a dark band with the accent as text in vivid.
   *
   * It gets its own three tokens rather than reusing the tag colours it used to
   * borrow. Those are worn by chips INSIDE white modals, so pushing them dark
   * for the vivid skin would have taken the modals with them.
   */
  bandBg: string;
  bandBorder: string;
  bandText: string;

  /*
   * The house motto and the highlight rule beside it — indigo in both skins,
   * because it is the brand mark and not the guest's palette choice. Only the
   * step changes, so it stays legible once the banner behind it goes dark.
   */
  brandText: string;
  brandBorder: string;

  /*
   * A coloured glow under the primary action. Empty in classic — the flat
   * button is the classic look, and a shadow class that resolves to nothing is
   * cheaper for every component than asking which skin is on.
   */
  glow: string;

  /*
   * The slow drift across a gradient button (see index.css). A token rather
   * than a `vibe === "vivid"` at each call site, so a component pairs it with
   * `btn` and never has to know which skin it is wearing. Empty in classic,
   * and the keyframes bow out under prefers-reduced-motion.
   */
  btnMotion: string;
}

/* Classic chrome is the white bar TiBook has always had, lifted out so the five
   palettes do not each restate it. */
const CLASSIC_CHROME = {
  vibe: "classic" as const,
  chrome: "bg-white",
  chromeText: "text-gray-800",
  chromeMuted: "text-gray-500",
  chromeBorder: "border-gray-200",
  chromeHover: "hover:bg-gray-50",
  chromeRing: "ring-gray-400",
  backdrop: "bg-white",
  glow: "",
  btnMotion: "",
  surface: "bg-white",
  surfaceSubtle: "bg-gray-50",
  surfaceBorder: "border-gray-100",
  surfaceText: "text-gray-800",
  surfaceMuted: "text-gray-500",
  brandText: "text-indigo-600",
  brandBorder: "border-indigo-300",
};

/* Vivid chrome is one dark base for all five palettes — the neon comes from the
   accent riding on it, not from tinting the bar itself, which at this size read
   as a muddy colour rather than as dark. */
const VIVID_CHROME = {
  vibe: "vivid" as const,
  chrome: "bg-slate-950",
  chromeText: "text-white",
  chromeMuted: "text-slate-400",
  chromeBorder: "border-slate-700",
  chromeHover: "hover:bg-slate-800",
  chromeRing: "ring-white",
  backdrop: "bg-slate-950",
  btnMotion: "tibook-vivid-drift",
  // Not quite the chrome black: the browse stack sits ON the chrome, and two
  // identical blacks lose the edge between the nav and the banner under it.
  surface: "bg-slate-900",
  surfaceSubtle: "bg-slate-800",
  surfaceBorder: "border-slate-800",
  surfaceText: "text-slate-100",
  surfaceMuted: "text-slate-400",
  // Same indigo, lifted until it reads on slate-900.
  brandText: "text-indigo-300",
  brandBorder: "border-indigo-400",
};

type ThemeCore = Omit<TiBookTheme, "bandBg" | "bandBorder" | "bandText">;

/*
 * The band tokens are DERIVED rather than typed out ten more times: in classic
 * the band is the accent tint the tags already carry, in vivid it is the dark
 * surface with the accent as text. Every string it copies is a literal that
 * already appears above, so Tailwind still sees all of them in the source.
 */
const withBand = (
  base: Record<ThemeName, ThemeCore>,
  band: (t: ThemeCore) => Pick<TiBookTheme, "bandBg" | "bandBorder" | "bandText">,
): Record<ThemeName, TiBookTheme> => {
  const out = {} as Record<ThemeName, TiBookTheme>;
  (Object.keys(base) as ThemeName[]).forEach((k) => {
    out[k] = { ...base[k], ...band(base[k]) };
  });
  return out;
};

const classicCore: Record<ThemeName, ThemeCore> = {
  green: {
    name: "green",
    ...CLASSIC_CHROME,
    chromeAccent: "text-green-600",
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
    ...CLASSIC_CHROME,
    chromeAccent: "text-amber-600",
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
    ...CLASSIC_CHROME,
    chromeAccent: "text-teal-600",
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
    ...CLASSIC_CHROME,
    chromeAccent: "text-rose-600",
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
    ...CLASSIC_CHROME,
    chromeAccent: "text-indigo-600",
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

/*
 * The neon set. Same five names, same slots, same meanings.
 *
 * Every class here is written out in full rather than built from a colour name
 * at run time: Tailwind reads the SOURCE to decide what to compile, so a
 * `from-${c}-500` would be a class that exists in the type system and nowhere
 * in the stylesheet. If you add a palette, spell it out.
 *
 * Two slots stay flat on purpose:
 *   textPrimary   sits on white cards (the available-date numbers, 37 uses).
 *   reviewText    sits on a white pill inside the action bar.
 * A gradient in either needs bg-clip-text and transparent text, which on a
 * calendar tile is a number the guest cannot read. The gradient belongs on the
 * things the guest presses, not on the things they read.
 */
const vividCore: Record<ThemeName, ThemeCore> = {
  green: {
    name: "green",
    ...VIVID_CHROME,
    chromeAccent: "text-emerald-300",
    dot: "bg-emerald-400",
    btn: "bg-gradient-to-r from-emerald-400 to-cyan-500",
    btnHover: "hover:from-emerald-300 hover:to-cyan-400",
    btnActive: "active:from-emerald-500 active:to-cyan-600",
    textPrimary: "text-emerald-600",
    textPrimaryDark: "text-emerald-700",
    tagBg: "bg-emerald-100",
    tagBorder: "border-emerald-300",
    tagText: "text-emerald-800",
    selectedBorder: "border-emerald-400",
    selectedShadow: "shadow-emerald-300",
    focusRing: "focus:ring-emerald-300",
    reviewText: "text-emerald-600",
    tileHover: "hover:bg-emerald-50",
    tileActive: "active:bg-emerald-100",
    successBg: "bg-emerald-100",
    glow: "shadow-lg shadow-emerald-500/50",
  },
  amber: {
    name: "amber",
    ...VIVID_CHROME,
    chromeAccent: "text-amber-300",
    dot: "bg-amber-400",
    btn: "bg-gradient-to-r from-amber-400 to-pink-500",
    btnHover: "hover:from-amber-300 hover:to-pink-400",
    btnActive: "active:from-amber-500 active:to-pink-600",
    textPrimary: "text-amber-600",
    textPrimaryDark: "text-amber-700",
    tagBg: "bg-amber-100",
    tagBorder: "border-amber-300",
    tagText: "text-amber-800",
    selectedBorder: "border-amber-400",
    selectedShadow: "shadow-amber-300",
    focusRing: "focus:ring-amber-300",
    reviewText: "text-amber-600",
    tileHover: "hover:bg-amber-50",
    tileActive: "active:bg-amber-100",
    successBg: "bg-amber-100",
    glow: "shadow-lg shadow-pink-500/50",
  },
  teal: {
    name: "teal",
    ...VIVID_CHROME,
    chromeAccent: "text-cyan-300",
    dot: "bg-cyan-400",
    btn: "bg-gradient-to-r from-cyan-400 to-blue-600",
    btnHover: "hover:from-cyan-300 hover:to-blue-500",
    btnActive: "active:from-cyan-500 active:to-blue-700",
    textPrimary: "text-cyan-700",
    textPrimaryDark: "text-cyan-800",
    tagBg: "bg-cyan-100",
    tagBorder: "border-cyan-300",
    tagText: "text-cyan-800",
    selectedBorder: "border-cyan-400",
    selectedShadow: "shadow-cyan-300",
    focusRing: "focus:ring-cyan-300",
    reviewText: "text-cyan-700",
    tileHover: "hover:bg-cyan-50",
    tileActive: "active:bg-cyan-100",
    successBg: "bg-cyan-100",
    glow: "shadow-lg shadow-cyan-500/50",
  },
  rose: {
    name: "rose",
    ...VIVID_CHROME,
    chromeAccent: "text-fuchsia-300",
    dot: "bg-fuchsia-400",
    btn: "bg-gradient-to-r from-fuchsia-500 to-rose-500",
    btnHover: "hover:from-fuchsia-400 hover:to-rose-400",
    btnActive: "active:from-fuchsia-600 active:to-rose-600",
    textPrimary: "text-fuchsia-600",
    textPrimaryDark: "text-fuchsia-700",
    tagBg: "bg-fuchsia-100",
    tagBorder: "border-fuchsia-300",
    tagText: "text-fuchsia-800",
    selectedBorder: "border-fuchsia-400",
    selectedShadow: "shadow-fuchsia-300",
    focusRing: "focus:ring-fuchsia-300",
    reviewText: "text-fuchsia-600",
    tileHover: "hover:bg-fuchsia-50",
    tileActive: "active:bg-fuchsia-100",
    successBg: "bg-fuchsia-100",
    glow: "shadow-lg shadow-fuchsia-500/50",
  },
  indigo: {
    name: "indigo",
    ...VIVID_CHROME,
    chromeAccent: "text-violet-300",
    dot: "bg-violet-400",
    btn: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
    btnHover: "hover:from-violet-400 hover:to-fuchsia-400",
    btnActive: "active:from-violet-600 active:to-fuchsia-600",
    textPrimary: "text-violet-600",
    textPrimaryDark: "text-violet-700",
    tagBg: "bg-violet-100",
    tagBorder: "border-violet-300",
    tagText: "text-violet-800",
    selectedBorder: "border-violet-400",
    selectedShadow: "shadow-violet-300",
    focusRing: "focus:ring-violet-300",
    reviewText: "text-violet-600",
    tileHover: "hover:bg-violet-50",
    tileActive: "active:bg-violet-100",
    successBg: "bg-violet-100",
    glow: "shadow-lg shadow-violet-500/50",
  },
};

const themes = withBand(classicCore, (t) => ({
  bandBg: t.tagBg,
  bandBorder: t.tagBorder,
  bandText: t.tagText,
}));

const vividThemes = withBand(vividCore, (t) => ({
  bandBg: t.surfaceSubtle,
  bandBorder: t.surfaceBorder,
  bandText: t.chromeAccent,
}));

const BOOKS: Record<VibeName, Record<ThemeName, TiBookTheme>> = {
  classic: themes,
  vivid: vividThemes,
};

interface TiBookThemeContextValue {
  theme: TiBookTheme;
  setTheme: (name: ThemeName) => void;
  vibe: VibeName;
  setVibe: (vibe: VibeName) => void;
  allThemes: TiBookTheme[];
}

const TiBookThemeContext = createContext<TiBookThemeContextValue>({
  theme: themes.green,
  setTheme: () => {},
  vibe: "classic",
  setVibe: () => {},
  allThemes: Object.values(themes),
});

const STORAGE_KEY = "tiBookTheme";
const VIBE_KEY = "tiBookVibe";

export const TiBookThemeProvider = ({ children }: { children: ReactNode }) => {
  const saved = (localStorage.getItem(STORAGE_KEY) as ThemeName) || "green";
  const [themeName, setThemeName] = useState<ThemeName>(
    Object.keys(themes).includes(saved) ? saved : "green"
  );
  /* Defaults to classic. A guest who has never chosen gets the TiBook they had
     yesterday rather than a surprise — the neon is opt-in, and the choice is
     remembered per device the same way the palette is. */
  const savedVibe = localStorage.getItem(VIBE_KEY) as VibeName | null;
  const [vibe, setVibeState] = useState<VibeName>(
    savedVibe === "vivid" ? "vivid" : "classic"
  );

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  const setVibe = (next: VibeName) => {
    setVibeState(next);
    localStorage.setItem(VIBE_KEY, next);
  };

  return (
    <TiBookThemeContext.Provider
      value={{
        theme: BOOKS[vibe][themeName],
        setTheme,
        vibe,
        setVibe,
        // Swatches are drawn from the skin in use, so the dots a guest picks
        // from are the colours they will actually get.
        allThemes: Object.values(BOOKS[vibe]),
      }}
    >
      {children}
    </TiBookThemeContext.Provider>
  );
};

export const useTiBookTheme = () => useContext(TiBookThemeContext);
