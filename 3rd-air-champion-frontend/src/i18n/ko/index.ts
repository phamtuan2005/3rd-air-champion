/*
 * TiBook's Korean, keyed by the English sentence it replaces (see
 * TiBookLanguageContext). Split by screen, as the German and Chinese are.
 *
 * Polite 해요체, worded like Airbnb Korea — 호스트, 슈퍼호스트, 위시리스트,
 * 체크인/체크아웃, 내 예약 — so a guest who has booked there reads what they
 * expect. Never 당신, which from a host to a guest reads as cold or rude.
 *
 * A Korean particle (은/는, 이/가, 을/를, 과/와) is chosen by the sound of the word
 * before it, and a {room} or {host} slot hides that word. So a particle never
 * follows a slot directly: the slot is anchored with a word whose sound is
 * known — "{host} 님은", "{room} 객실이" — or followed by one that never
 * changes (의, 에, 도, 부터, 까지). "Anh-Tuan이" vs "Anh-Tuan가" is a guess either
 * way, and a wrong one reads like a machine wrote it.
 *
 * Room names, TiBook, TT and AirBnB are names and stay as they are. Korean uses
 * ASCII punctuation, so unlike Chinese there is no "." entry.
 */
import { shell } from "./shell";
import { booking } from "./booking";
import { calendar } from "./calendar";
import { sheets } from "./sheets";
import { tt } from "./tt";

export const KO: Record<string, string> = {
  ...shell,
  ...booking,
  ...calendar,
  ...sheets,
  ...tt,
};
