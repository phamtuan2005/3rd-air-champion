/*
 * TiBook's German, keyed by the English sentence it replaces (see
 * TiBookLanguageContext). Split by screen so two people adding lines to
 * different screens do not collide in one file.
 *
 * Informal "du", as Airbnb writes to German guests: TiBook talks like a person
 * at the door, and "Sie" from the same voice would read as a form.
 */
import { shell } from "./shell";
import { booking } from "./booking";
import { calendar } from "./calendar";
import { sheets } from "./sheets";
import { tt } from "./tt";

export const DE: Record<string, string> = {
  ...shell,
  ...booking,
  ...calendar,
  ...sheets,
  ...tt,
};
