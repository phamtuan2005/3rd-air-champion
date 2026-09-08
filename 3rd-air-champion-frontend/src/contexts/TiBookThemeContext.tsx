import { createContext, useContext, useState, ReactNode } from "react";
import { getRoomColor } from "../util/getRoomColor";

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

/*
 * A THIRD thing a guest can choose, and the first one that is not paint.
 *
 * "stack" is the arrangement TiBook has always had: host banner, house facts,
 * room strip and month grid stacked down the page, with the nav across the top.
 * "hero" is the one drawn in the Gen Z round — the rooms take the top two
 * fifths as a swipeable card, the month takes the lower three, and the actions
 * move to a bar under the thumb.
 *
 * Held apart from the skin on purpose, even though the menu currently offers
 * them as one choice ("Hero" means vivid + hero). They are different kinds of
 * thing: a skin is values behind tokens and reaches every screen, a layout is
 * a different arrangement of the SAME screens. Keeping them separate is what
 * lets the menu offer a light Hero later without any of this moving.
 *
 * What a layout must NOT be is a second set of rules. Hero drives the exact
 * same selectedRoomIds the room filter has always driven, so the calendar
 * answers "is this room free" with the one availability rule there has ever
 * been (TIBOOK.md rule 1).
 */
export type LayoutName = "stack" | "hero";

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
   * The chrome went dark first and the rest followed. The ~130 greys written
   * into the markup were the reason to stop at the frame once, and they are
   * exactly why they became tokens instead: a guest reading their total on a
   * dark sheet needs the text to have moved WITH the surface, not to have
   * stayed where it was chosen against white.
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
  // The gap a selection ring leaves around a swatch. Defaults to white in
  // Tailwind, which is a bright halo once the panel behind it is dark.
  ringOffset: string;
  // Behind everything, where no panel paints over it.
  backdrop: string;

  /*
   * Surfaces — the browse stack a guest lands on: host banner, house facts,
   * room cards. These follow the chrome into the dark, because they are the
   * first screenful and a dark bar sitting on a white banner reads as a bug
   * rather than as a choice.
   *
   * The calendar grid and the sheets followed. Nothing is left light, which is
   * why the scale below is faithful rather than approximate: these carry the
   * numbers a guest acts on — the nights that are free, their rate, their
   * total, the door code — and every one is read on a phone in a hallway at
   * 11pm.
   */
  surface: string;
  surfaceSubtle: string;
  surfaceBorder: string;
  /*
   * A faithful scale, not a rounded-off one.
   *
   * Every step here exists because the light skin already used that exact grey,
   * and collapsing two of them would quietly restyle Classic — a gray-400 label
   * becoming gray-500 across forty places is not a change anyone asked for. So
   * the classic column reads back as the literal it replaced, and only the dark
   * column is new.
   */
  surfaceStrong: string;
  surfaceText: string;
  surfaceText2: string;
  surfaceText3: string;
  surfaceMuted: string;
  surfaceMuted2: string;
  dim: string;
  surfaceInset: string;
  line: string;
  lineStrong: string;
  ringLine: string;
  ringLine2: string;
  surfaceHover2: string;
  surfaceActive: string;

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
   * The calendar grid, which follows the frame down now rather than staying a
   * lit sheet under it.
   *
   * Its own slots because the tile is not a card: a day number sits directly on
   * the grid, and the two greys it used (300 for a night that is gone, 500 for
   * "sold out") carry different meanings that both have to survive the dark.
   * gridLine has a CSS-variable twin in index.css — the grid draws its outer
   * two borders as inline styles, which no class can reach.
   *
   * tileText is for text on the TILE. The room name on a stay ribbon is not
   * that: it sits on a bright room colour and stays near-black in both skins.
   */
  gridLine: string;
  tileText: string;
  tileWishBg: string;
  tileWishHover: string;

  /*
   * Text fields, which cannot simply inherit: an input keeps the browser's
   * white background and near-black text unless told otherwise, so on a dark
   * sheet a guest types their phone number into a white slot.
   */
  field: string;
  fieldFocus: string;
  // Small furniture that is neither text nor a panel: the grab bar on a sheet,
  // the spinner ring, and the lift a muted label gets on hover. Each needs a
  // value in both skins and none of them is worth a component knowing why.
  handle: string;
  spinner: string;
  mutedHover: string;
  // The dimmer behind a sheet. Deeper in the dark skin, where a 30% wash over
  // an already dark page stopped separating the sheet from the app behind it.
  scrim: string;

  /*
   * Two whole CARDS that carry a colour rather than a tint — the stay a guest
   * is on right now, and the "remove this date?" confirm.
   *
   * They cannot stay pale once the sheet is dark. Their body text comes from
   * surfaceText, which is near-white in the dark skin, and near-white on
   * amber-50 is a card a guest cannot read on the morning they are checking in.
   * Held as a translucent wash of the same hue instead, so the signal survives
   * and the text on top of it still works.
   */
  /*
   * Warm (a stay being held, a stay happening now) and alert (a "remove this?"
   * confirm). Both are whole containers with their own coloured text, and both
   * break the same way in the dark: a pale amber panel keeps its near-black
   * amber text, and near-black on near-black is a total a guest cannot read on
   * the morning they check in.
   *
   * So the fill becomes a translucent wash of the same hue and the text lifts
   * to meet it. The signal survives; only the direction of the contrast flips.
   *
   * These collapse a few neighbouring shades that the light skin distinguished
   * (amber-700 and -800 both land on warmStrong, every red text hover on
   * alertHover). Those differences were not visible on a pale chip; the ones
   * that WERE visible each still have their own token.
   */
  // A chip that inverts to mark itself chosen. It has to flip with the skin:
  // near-black is invisible on a near-black sheet.
  chipOn: string;
  cardWarm: string;
  warmFill: string;
  warmFill2: string;
  warmHover: string;
  warmBorder: string;
  warmText2: string;
  warmStrong: string;
  warmDim: string;
  alertFill: string;
  alertBorder: string;
  alertBorderHover: string;
  alertText2: string;
  alertText3: string;
  // The label that rides on cardWarm, which has to lift with it.
  warmText: string;
  cardAlert: string;
  alertText: string;
  alertHover: string;

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
  ringOffset: "ring-offset-white",
  backdrop: "bg-white",
  glow: "",
  btnMotion: "",
  surface: "bg-white",
  surfaceSubtle: "bg-gray-50",
  surfaceBorder: "border-gray-100",
  surfaceStrong: "text-gray-900",
  surfaceText: "text-gray-800",
  surfaceText2: "text-gray-700",
  surfaceText3: "text-gray-600",
  surfaceMuted: "text-gray-500",
  surfaceMuted2: "text-gray-400",
  surfaceInset: "bg-gray-100",
  line: "border-gray-200",
  lineStrong: "border-gray-300",
  ringLine: "ring-gray-200",
  ringLine2: "ring-gray-300",
  surfaceHover2: "hover:bg-gray-100",
  surfaceActive: "active:bg-gray-100",
  brandText: "text-indigo-600",
  brandBorder: "border-indigo-300",
  gridLine: "border-gray-300",
  tileText: "text-black",
  dim: "text-gray-300",
  tileWishBg: "bg-gray-200",
  tileWishHover: "hover:bg-gray-100",
  field: "",
  fieldFocus: "focus:border-gray-400",
  handle: "bg-gray-300",
  spinner: "border-gray-300 border-t-gray-500",
  mutedHover: "hover:text-gray-600",
  scrim: "bg-black/30",
  chipOn: "bg-gray-900 text-white",
  cardWarm: "bg-amber-50 border-amber-200",
  warmFill: "bg-amber-50",
  warmFill2: "bg-amber-100",
  warmHover: "hover:bg-amber-100",
  warmBorder: "border-amber-200",
  warmText2: "text-amber-700",
  warmStrong: "text-amber-800",
  warmDim: "text-amber-400",
  alertFill: "bg-red-50",
  alertBorder: "border-red-200",
  alertBorderHover: "hover:border-red-400",
  alertText2: "text-red-500",
  alertText3: "text-red-700",
  warmText: "text-amber-600",
  cardAlert: "bg-red-50 border-red-200",
  alertText: "text-red-600",
  alertHover: "hover:text-red-800",
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
  ringOffset: "ring-offset-slate-900",
  backdrop: "bg-slate-950",
  btnMotion: "tibook-vivid-drift",
  // Not quite the chrome black: the browse stack sits ON the chrome, and two
  // identical blacks lose the edge between the nav and the banner under it.
  surface: "bg-slate-900",
  surfaceSubtle: "bg-slate-800",
  surfaceBorder: "border-slate-800",
  surfaceStrong: "text-slate-50",
  surfaceText: "text-slate-100",
  surfaceText2: "text-slate-200",
  surfaceText3: "text-slate-300",
  surfaceMuted: "text-slate-400",
  surfaceMuted2: "text-slate-500",
  surfaceInset: "bg-slate-800",
  line: "border-slate-700",
  lineStrong: "border-slate-600",
  ringLine: "ring-slate-700",
  ringLine2: "ring-slate-600",
  surfaceHover2: "hover:bg-slate-800",
  surfaceActive: "active:bg-slate-800",
  // Same indigo, lifted until it reads on slate-900.
  brandText: "text-indigo-300",
  brandBorder: "border-indigo-400",
  gridLine: "border-slate-700",
  tileText: "text-slate-100",
  // Dimmer than the muted step, not brighter: this is a night the guest cannot
  // have, and it has to read as gone without disappearing altogether.
  dim: "text-slate-600",
  tileWishBg: "bg-slate-700",
  tileWishHover: "hover:bg-slate-800",
  field: "bg-slate-800 text-slate-100 placeholder:text-slate-500",
  fieldFocus: "focus:border-slate-500",
  handle: "bg-slate-600",
  spinner: "border-slate-700 border-t-slate-300",
  mutedHover: "hover:text-slate-200",
  scrim: "bg-black/60",
  chipOn: "bg-slate-100 text-slate-900",
  cardWarm: "bg-amber-400/15 border-amber-400/40",
  warmFill: "bg-amber-400/10",
  warmFill2: "bg-amber-400/20",
  warmHover: "hover:bg-amber-400/20",
  warmBorder: "border-amber-400/40",
  warmText2: "text-amber-300",
  warmStrong: "text-amber-200",
  warmDim: "text-amber-500",
  alertFill: "bg-red-400/12",
  alertBorder: "border-red-400/40",
  alertBorderHover: "hover:border-red-400/80",
  alertText2: "text-red-300",
  alertText3: "text-red-200",
  warmText: "text-amber-300",
  cardAlert: "bg-red-400/15 border-red-400/40",
  alertText: "text-red-300",
  alertHover: "hover:text-red-200",
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
 *   textPrimary   is a date number on the grid (37 uses).
 *   reviewText    sits on a white pill inside the action bar, so unlike the
 *                 rest of this set it stays DARK — that pill rides on the
 *                 gradient, not on a sheet, and does not follow the skin.
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
    textPrimary: "text-emerald-400",
    textPrimaryDark: "text-emerald-300",
    tagBg: "bg-emerald-400/15",
    tagBorder: "border-emerald-400/40",
    tagText: "text-emerald-200",
    selectedBorder: "border-emerald-400",
    selectedShadow: "shadow-emerald-300",
    focusRing: "focus:ring-emerald-300",
    reviewText: "text-emerald-600",
    tileHover: "hover:bg-emerald-400/10",
    tileActive: "active:bg-emerald-400/20",
    successBg: "bg-emerald-400/20",
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
    textPrimary: "text-amber-400",
    textPrimaryDark: "text-amber-300",
    tagBg: "bg-amber-400/15",
    tagBorder: "border-amber-400/40",
    tagText: "text-amber-200",
    selectedBorder: "border-amber-400",
    selectedShadow: "shadow-amber-300",
    focusRing: "focus:ring-amber-300",
    reviewText: "text-amber-600",
    tileHover: "hover:bg-amber-400/10",
    tileActive: "active:bg-amber-400/20",
    successBg: "bg-amber-400/20",
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
    textPrimary: "text-cyan-400",
    textPrimaryDark: "text-cyan-300",
    tagBg: "bg-cyan-400/15",
    tagBorder: "border-cyan-400/40",
    tagText: "text-cyan-200",
    selectedBorder: "border-cyan-400",
    selectedShadow: "shadow-cyan-300",
    focusRing: "focus:ring-cyan-300",
    reviewText: "text-cyan-700",
    tileHover: "hover:bg-cyan-400/10",
    tileActive: "active:bg-cyan-400/20",
    successBg: "bg-cyan-400/20",
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
    textPrimary: "text-fuchsia-400",
    textPrimaryDark: "text-fuchsia-300",
    tagBg: "bg-fuchsia-400/15",
    tagBorder: "border-fuchsia-400/40",
    tagText: "text-fuchsia-200",
    selectedBorder: "border-fuchsia-400",
    selectedShadow: "shadow-fuchsia-300",
    focusRing: "focus:ring-fuchsia-300",
    reviewText: "text-fuchsia-600",
    tileHover: "hover:bg-fuchsia-400/10",
    tileActive: "active:bg-fuchsia-400/20",
    successBg: "bg-fuchsia-400/20",
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
    textPrimary: "text-violet-400",
    textPrimaryDark: "text-violet-300",
    tagBg: "bg-violet-400/15",
    tagBorder: "border-violet-400/40",
    tagText: "text-violet-200",
    selectedBorder: "border-violet-400",
    selectedShadow: "shadow-violet-300",
    focusRing: "focus:ring-violet-300",
    reviewText: "text-violet-600",
    tileHover: "hover:bg-violet-400/10",
    tileActive: "active:bg-violet-400/20",
    successBg: "bg-violet-400/20",
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
  layout: LayoutName;
  setLook: (vibe: VibeName, layout: LayoutName) => void;
  allThemes: TiBookTheme[];
}

const TiBookThemeContext = createContext<TiBookThemeContextValue>({
  theme: themes.green,
  setTheme: () => {},
  vibe: "classic",
  setVibe: () => {},
  layout: "stack",
  setLook: () => {},
  allThemes: Object.values(themes),
});

const STORAGE_KEY = "tiBookTheme";
const VIBE_KEY = "tiBookVibe";
const LAYOUT_KEY = "tiBookLayout";

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
  /* Also defaults to what TiBook has always been. A guest who has chosen
     nothing gets the app they had yesterday. */
  const savedLayout = localStorage.getItem(LAYOUT_KEY) as LayoutName | null;
  const [layout, setLayoutState] = useState<LayoutName>(
    savedLayout === "hero" ? "hero" : "stack"
  );

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  const setVibe = (next: VibeName) => setLook(next, layout);

  /* Skin and layout move together, because the menu offers them together. One
     setter so a look can never land half-applied — a guest mid-switch seeing
     the hero arrangement in the light skin for a frame is a flicker nobody
     asked for. */
  const setLook = (nextVibe: VibeName, nextLayout: LayoutName) => {
    setVibeState(nextVibe);
    setLayoutState(nextLayout);
    try {
      localStorage.setItem(VIBE_KEY, nextVibe);
      localStorage.setItem(LAYOUT_KEY, nextLayout);
    } catch {
      // Private browsing. The choice holds for this visit and is asked again
      // next time, which is the harmless way round.
    }
  };

  return (
    <TiBookThemeContext.Provider
      value={{
        theme: BOOKS[vibe][themeName],
        setTheme,
        vibe,
        setVibe,
        layout,
        setLook,
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

/*
 * A room's own colour, dressed for the skin it is shown in.
 *
 * Room colour is not a theme token and must not become one: it is per-room, it
 * comes off the room record, and it is the one colour on the screen a guest
 * learns rather than picks — King is red in the calendar, on the card, in the
 * request and on the hold, and it has to stay red in both skins or it stops
 * being an identity.
 *
 * So the hue is left exactly alone and the neon is added around it: a glow in
 * the room's own colour, and a diagonal sheen across the chip. On a near-black
 * sheet a saturated -500 already pops; the glow is what makes it read as lit
 * rather than merely bright.
 *
 * The vibe check lives HERE rather than at the eight call sites, so a component
 * still only asks "how does this room look", never "which skin am I".
 *
 * Every glow is spelled out because Tailwind reads the source to decide what to
 * compile -- a shadow built from a colour name at run time would exist in the
 * type system and nowhere in the stylesheet. The keys are what getRoomColor can
 * return, plus whatever a room record carries; anything unrecognised still gets
 * a glow, just a colourless one.
 */
const ROOM_GLOW: Record<string, string> = {
  "bg-red-500": "shadow-[0_0_12px_-1px_rgba(239,68,68,0.9)]",
  "bg-yellow-500": "shadow-[0_0_12px_-1px_rgba(234,179,8,0.9)]",
  "bg-blue-500": "shadow-[0_0_12px_-1px_rgba(59,130,246,0.9)]",
  "bg-green-500": "shadow-[0_0_12px_-1px_rgba(34,197,94,0.9)]",
  "bg-purple-500": "shadow-[0_0_12px_-1px_rgba(168,85,247,0.9)]",
  "bg-pink-500": "shadow-[0_0_12px_-1px_rgba(236,72,153,0.9)]",
  "bg-indigo-500": "shadow-[0_0_12px_-1px_rgba(99,102,241,0.9)]",
  "bg-gray-500": "shadow-[0_0_12px_-1px_rgba(107,114,128,0.9)]",
  "bg-gray-400": "shadow-[0_0_12px_-1px_rgba(156,163,175,0.9)]",
  "bg-teal-500": "shadow-[0_0_12px_-1px_rgba(20,184,166,0.9)]",
  "bg-orange-500": "shadow-[0_0_12px_-1px_rgba(249,115,22,0.9)]",
};
const ROOM_GLOW_FALLBACK = "shadow-[0_0_12px_-1px_rgba(255,255,255,0.45)]";

/*
 * "bar" is for a stay ribbon on the calendar, which is not one element but
 * several — an AM cap, the whole days, a PM start — laid end to end to look
 * like one bar. A diagonal sheen restarts at each of those, so a three-night
 * stay came out visibly banded at the seams. The bar sheen runs top-to-bottom
 * instead: identical at every x, so the seams disappear and the ribbon reads as
 * one lit tube rather than three tiles.
 *
 * The caller picks by SHAPE — chip or bar — never by skin.
 */
export const useRoomChip = () => {
  const { vibe } = useTiBookTheme();
  return (room: { name: string; color?: string }, shape: "chip" | "bar" = "chip") => {
    const bg = getRoomColor(room.name, room.color);
    if (vibe !== "vivid") return bg;
    const sheen = shape === "bar" ? "tibook-room-neon-bar" : "tibook-room-neon";
    return `${bg} ${sheen} ${ROOM_GLOW[bg] ?? ROOM_GLOW_FALLBACK}`;
  };
};
