/*
 * TiBook's Vietnamese, keyed by the English sentence it replaces (see
 * TiBookLanguageContext). Split by screen, as the others are.
 *
 * The guest is always "bạn", as Airbnb Vietnam writes: never "quý khách",
 * which reads like a bank, nor "anh/chị", which guesses at the guest's age and
 * gender. The house speaks as "chúng tôi"; TT calls itself "mình". The host is
 * "anh ấy" in the third person, as the English says "he".
 *
 * Words Airbnb's Vietnamese guests already know: chủ nhà, Chủ nhà siêu cấp,
 * khách, đặt phòng, kỳ lưu trú, danh sách yêu thích, nhận phòng/trả phòng. A
 * held (reserved, unpaid) stay is "đang giữ chỗ" — never "đã đặt", which
 * reads as confirmed.
 *
 * Dates in examples are written the way the date box reads them back: day
 * before month, "10-12 tháng 10".
 *
 * Room names, TiBook, TT, "Ask TT" and AirBnB are names and stay as they are.
 */
import { shell } from "./shell";
import { booking } from "./booking";
import { calendar } from "./calendar";
import { sheets } from "./sheets";
import { tt } from "./tt";

export const VI: Record<string, string> = {
  ...shell,
  ...booking,
  ...calendar,
  ...sheets,
  ...tt,
};
