/*
 * TiBook's Chinese, keyed by the English sentence it replaces (see
 * TiBookLanguageContext). Split by screen, as the German is, so two people
 * adding lines to different screens do not collide in one file.
 *
 * Simplified, and "您": German's informal "du" follows Airbnb.de, but Airbnb
 * and Booking.com address Chinese guests as 您, and 你 from a host to a guest
 * reads as over-familiar. The words are Airbnb China's too — 房东, 超赞房东,
 * 心愿单, 入住/退房 — so a guest who has booked there reads what they expect.
 *
 * Room names, TiBook, TT and AirBnB are names and stay as they are. A space
 * goes between Chinese and a Latin word, including round the {room} and {host}
 * slots, which are almost always Latin.
 */
import { shell } from "./shell";
import { booking } from "./booking";
import { calendar } from "./calendar";
import { sheets } from "./sheets";
import { tt } from "./tt";

export const ZH: Record<string, string> = {
  ...shell,
  ...booking,
  ...calendar,
  ...sheets,
  ...tt,
};
