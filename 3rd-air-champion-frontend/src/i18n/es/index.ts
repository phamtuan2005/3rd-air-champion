/*
 * TiBook's Spanish, keyed by the English sentence it replaces (see
 * TiBookLanguageContext). Split by screen, as the others are.
 *
 * Neutral Latin American Spanish with "tú", as Airbnb writes to Spanish-
 * speaking guests: the house's Spanish-speaking guests are mostly from Mexico
 * and Central America or grew up in California, and Spain's "vosotros",
 * "móvil" and "ordenador" would read as foreign to them. Never "vos".
 *
 * Words Airbnb's Latin American guests already know: anfitrión, Superanfitrión,
 * huésped, reserva, estadía, lista de deseos, llegada/salida. A held (reserved,
 * unpaid) stay is "apartada" — "reservada" would read as confirmed.
 *
 * Spanish genders every adjective, and TiBook rarely knows the guest's gender
 * or a room name's. So lines are written around it — "Hola de nuevo" rather
 * than "Bienvenido/a", "{room} está libre" rather than "ocupada".
 *
 * Room names, TiBook, TT, "Ask TT" and AirBnB are names and stay as they are.
 */
import { shell } from "./shell";
import { booking } from "./booking";
import { calendar } from "./calendar";
import { sheets } from "./sheets";
import { tt } from "./tt";

export const ES: Record<string, string> = {
  ...shell,
  ...booking,
  ...calendar,
  ...sheets,
  ...tt,
};
