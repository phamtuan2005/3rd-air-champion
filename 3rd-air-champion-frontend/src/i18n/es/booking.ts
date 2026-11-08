// Spanish for TiBook's booking screens — see index.ts.
//
// Neutral Latin American Spanish with "tú", worded the way Airbnb writes to
// Spanish-speaking guests: never "vos" or "vosotros", and no Spain-only words.
//
// Some lines are pieces of a sentence the screen assembles (" — tap to add
// them" after a count). They are translated as the piece they are, so the
// Spanish still reads when the pieces are put together.
export const booking: Record<string, string> = {
  // ── Booking request: header and steps ──
  "Your Dates": "Tus fechas",
  "Your Booking": "Tu reserva",
  "About You": "Sobre ti",
  "Pick your dates — just one more step after this": "Elige tus fechas: después solo falta un paso",
  "Check it over and send — we have the rest": "Revisa y envía: lo demás ya lo tenemos",
  "Last step — fill in your info and you're done": "Último paso: completa tus datos y listo",
  "Step {step} of 2": "Paso {step} de 2",
  "All done!": "¡Listo!",
  Close: "Cerrar",

  // ── Success screen ──
  "Request sent!": "¡Solicitud enviada!",
  "We'll be in touch shortly to confirm your stay. Can't wait to host you!":
    "Te contactaremos pronto para confirmar tu estadía. ¡Tenemos muchas ganas de recibirte!",
  "We'll let you know as soon as those dates open up!": "¡Te avisaremos en cuanto esas fechas queden libres!",
  "We'll also notify you if your wish list dates become available.":
    "También te avisaremos si las fechas de tu lista de deseos quedan disponibles.",
  "While you wait — our house rules": "Mientras esperas: nuestras reglas de la casa",

  // ── Step 1: dates ──
  "Your dates include a US holiday": "Tus fechas incluyen un feriado de EE. UU.",
  "Your dates include {n} US holidays": "Tus fechas incluyen {n} feriados de EE. UU.",
  // "Feriado" rather than Spain's "festivo": it is the word most of Latin
  // America uses for a public holiday.
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay that night?":
    "Al elegir varias noches seguidas, es fácil incluir un feriado sin querer. ¿Quieres quedarte esa noche?",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay those nights?":
    "Al elegir varias noches seguidas, es fácil incluir un feriado sin querer. ¿Quieres quedarte esas noches?",
  "Choose one to continue.": "Elige una opción para continuar.",
  "Take it out": "Quitarla",
  "Take them out": "Quitarlas",
  "Keep — I'll be staying": "Mantener: me quedo",
  "Holiday night kept:": "Noche de feriado que mantienes:",
  "Holiday nights kept:": "Noches de feriado que mantienes:",
  "Dates picked from calendar": "Fechas elegidas en el calendario",
  "{n} night": "{n} noche",
  "{n} nights": "{n} noches",
  "{date} · 1 night": "{date} · 1 noche",
  "{start} – {end} · {n} nights": "{start} – {end} · {n} noches",
  "Remove {what}?": "¿Quitar {what}?",
  "Yes, remove": "Sí, quitar",
  Keep: "Mantener",
  Remove: "Quitar",
  "Calendar — tap to pick more dates": "Calendario: toca para elegir más fechas",
  "Tap here to browse the calendar": "Toca aquí para ver el calendario",
  "Pick your dates and come back to complete your request": "Elige tus fechas y vuelve para completar tu solicitud",
  "Sold-out dates (wish list)": "Fechas completas (lista de deseos)",
  "We'll notify you if these open up.": "Te avisaremos si quedan libres.",
  "and / or": "y / o",
  "Write your dates": "Escribe tus fechas",
  // Spanish dates on purpose, as Chinese and Korean do: this is the form to
  // type for the date box to pick the dates up ("1 de mayo"; a bare "3–5"
  // carries the month on, as in English).
  "e.g. May 1, 3–5, 20–21 — or anything else you'd like us to know":
    "p. ej., 1 de mayo, 3–5, 20–21, o cualquier otra cosa que quieras contarnos",
  "e.g. May 1, 3–5, 20–21\nor anything else you'd like us to know":
    "p. ej., 1 de mayo, 3–5, 20–21\no cualquier otra cosa que quieras contarnos",
  "Please pick dates on the calendar or write your dates below.":
    "Elige fechas en el calendario o escribe tus fechas abajo.",
  "1 date read from what you wrote": "Encontramos 1 fecha en lo que escribiste",
  "{n} dates read from what you wrote": "Encontramos {n} fechas en lo que escribiste",
  " — tap to add them": ": toca para agregarlas",
  "{day} has already gone by": "{day} ya pasó",
  "{n} of those nights have already gone by": "{n} de esas noches ya pasaron",
  " — we've kept the rest.": ": mantuvimos las demás.",
  "Next — Finalize your booking →": "Siguiente: finaliza tu reserva →",
  "Next — Tell us about you →": "Siguiente: cuéntanos sobre ti →",

  // ── The write-your-dates sheet ──
  "We read this date": "Encontramos esta fecha",
  "We read these {n} dates": "Encontramos estas {n} fechas",
  "This night has already gone by": "Esta noche ya pasó",
  "{n} of these nights have already gone by": "{n} de estas noches ya pasaron",
  "We've left those out and kept the rest.": "Las quitamos y mantuvimos las demás.",
  "Nothing to add from this yet.": "Todavía no hay nada que agregar.",
  "If you meant next year, add the year — \"{example}\" — and we'll pick it up.":
    "Si te refieres al próximo año, agrega el año, por ejemplo “{example}”, y lo tomaremos en cuenta.",
  "No need to book — that night is already yours.": "No necesitas reservar: esa noche ya es tuya.",
  "No need to book — those nights are already yours.": "No necesitas reservar: esas noches ya son tuyas.",
  "{n} of these night is already booked in your name — nothing to do for it.":
    "{n} de estas noches ya está reservada a tu nombre: no tienes que hacer nada.",
  "{n} of these nights are already booked in your name — nothing to do for them.":
    "{n} de estas noches ya están reservadas a tu nombre: no tienes que hacer nada.",
  "The crossed-out date is full tonight — we'll watch it for you and tell you the moment it opens up.":
    "La fecha tachada está completa por ahora: la vigilaremos por ti y te avisaremos en cuanto quede libre.",
  "The crossed-out dates are full tonight — we'll watch them for you and tell you the moment they open up.":
    "Las fechas tachadas están completas por ahora: las vigilaremos por ti y te avisaremos en cuanto queden libres.",
  "All of these are already in your request.": "Todas ya están en tu solicitud.",
  "We'll pass this on too: \"{text}\"": "También enviaremos esto: “{text}”",
  "Request {n} date, watch {m} more": "Solicitar {n} fecha y vigilar {m} más",
  "Request {n} dates, watch {m} more": "Solicitar {n} fechas y vigilar {m} más",
  "Add {n} date to my request": "Agregar {n} fecha a mi solicitud",
  "Add {n} dates to my request": "Agregar {n} fechas a mi solicitud",
  "Watch {n} full date for me": "Vigilar {n} fecha completa por mí",
  "Watch {n} full dates for me": "Vigilar {n} fechas completas por mí",
  Done: "Listo",

  // ── Step 2: about you / your booking ──
  "Your phone number": "Tu teléfono",
  "So we can reach you": "Para poder contactarte",
  "Please enter your phone number": "Escribe tu número de teléfono",
  "looking up...": "buscando...",
  "We'll sort out pricing together after your request.": "Acordaremos el precio contigo después de tu solicitud.",
  "Your name": "Tu nombre",
  // A common Latin American placeholder name, as the other languages use one
  // of their own.
  "e.g. John Smith": "p. ej., Juan Pérez",
  "Please enter your name": "Escribe tu nombre",
  "Room summary": "Resumen de la habitación",
  // Short, like the German "N.": it sits beside a price in a tight row.
  "{n}n": "{n} n.",
  "~${amount} estimated": "~${amount} aprox.",
  "{n} separate stays — pick a room for each.": "{n} estadías separadas: elige una habitación para cada una.",
  "No room free for these nights": "No hay habitaciones libres para estas noches",
  "Select a room": "Elige una habitación",
  "${rate}/night": "${rate}/noche",
  "~${total} ({n}n × ${rate}/night)": "~${total} ({n} n. × ${rate}/noche)",
  "({n}n × ${rate}/night)": "({n} n. × ${rate}/noche)",
  "Total estimate": "Total estimado",
  "Which room?": "¿Qué habitación?",
  "Checking availability...": "Revisando disponibilidad...",
  "No rooms available — try different dates.": "No hay habitaciones disponibles: prueba con otras fechas.",
  "Please choose a room": "Elige una habitación",
  "Please pick a room for {stay}.": "Elige una habitación para {stay}.",
  "Wish list dates": "Fechas de la lista de deseos",
  "How many people?": "¿Cuántas personas?",
  "{n} person": "{n} persona",
  "{n} people": "{n} personas",
  "Something went wrong — please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "Hide ▴": "Ocultar ▴",
  "Details ▾": "Detalles ▾",
  "Sending...": "Enviando...",
  "Send My Request": "Enviar mi solicitud",

  // ── Cancellation policy ──
  "Free cancellation up to {days} days before check-in": "Cancelación gratuita hasta {days} días antes de la llegada",
  "We fully understand your plans can change, and TT House will be flexible with that.":
    "Entendemos que tus planes pueden cambiar, y en TT House seremos flexibles.",
  "Full refund if you cancel {full}+ days before check-in": "Reembolso total si cancelas {full} días o más antes de la llegada",
  "50% refund if {half}–{last} days before": "Reembolso del 50 % si cancelas entre {half} y {last} días antes",
  "No refund within {half} days.": "Sin reembolso en los {half} días previos a la llegada.",
  "Feel free to reach out to us anytime!": "¡Escríbenos cuando quieras!",

  // ── US holidays (names as Spanish speakers in the US know them) ──
  "{name} (observed)": "{name} (día feriado trasladado)",
  "{holiday} — a US holiday": "{holiday}: feriado de EE. UU.",
  "Make sure you mean to stay this night before you add it.":
    "Antes de agregarla, confirma que quieres quedarte esta noche.",
  "New Year's Day": "Año Nuevo",
  "Martin Luther King Jr. Day": "Día de Martin Luther King Jr.",
  "Presidents' Day": "Día de los Presidentes",
  "Memorial Day": "Día de los Caídos (Memorial Day)",
  Juneteenth: "Juneteenth",
  "Independence Day": "Día de la Independencia (EE. UU.)",
  // Labor Day is in September in the US; "(EE. UU.)" stops a guest reading it
  // as May 1, which is the Día del Trabajo they know at home.
  "Labor Day": "Día del Trabajo (EE. UU.)",
  "Columbus Day": "Día de la Raza (Columbus Day)",
  "Veterans Day": "Día de los Veteranos",
  Thanksgiving: "Día de Acción de Gracias",
  "Christmas Day": "Navidad",

  // ── Room picker ──
  "Only 1 room left": "Solo queda 1 habitación",
  "Pick your room": "Elige tu habitación",
  "No other room is free for these dates.": "No hay otra habitación libre en estas fechas.",
  "Select ›": "Elegir ›",
  "Any available room": "Cualquier habitación disponible",

  // ── Held (reserved) bookings ──
  // Stands in for the host's first name in {host}, which follows "a"
  // ("avísale a {host}"). "tu anfitrión" reads after "a"; "el anfitrión"
  // would give "a el", which Spanish never writes.
  "the host": "tu anfitrión",
  "No charge": "Sin costo",
  "A booking is held for you": "Tienes una reserva apartada",
  "{n} bookings held for you": "Tienes {n} reservas apartadas",
  "Pending payment": "Pago pendiente",
  "We're holding this booking just for you. To keep it, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "Estamos guardando esta reserva solo para ti. Para conservarla, envía tu pago pronto: las reservas sin pagar pueden liberarse para que otros huéspedes reserven. 🙏",
  "We're holding these bookings just for you. To keep them, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "Estamos guardando estas reservas solo para ti. Para conservarlas, envía tu pago pronto: las reservas sin pagar pueden liberarse para que otros huéspedes reserven. 🙏",
  "You'd planned to send payment by {date} — no problem if you need a little longer, just let {host} know.":
    "Planeabas enviar el pago antes del {date}. Si necesitas un poco más de tiempo, no hay problema: solo avísale a {host}.",
  "You said you'd send payment by {date} — thank you!": "Dijiste que enviarías el pago antes del {date}. ¡Gracias!",
  "{amount} fees": "{amount} en tarifas",
  "{amount} loyalty discount applied": "Descuento por cliente frecuente de {amount} aplicado",
  Total: "Total",
  "Total to pay": "Total a pagar",
  "Message {host} to pay": "Escríbele a {host} para pagar",
  "Got it": "Entendido",
  "Asked for one of these by mistake? Just let {host} know and it will be released.":
    "¿Pediste alguna por error? Solo avísale a {host} y se liberará.",

  // ── Your stay ──
  // Says what is happening, not who: "Hospedado/a" would have to guess the
  // guest's gender.
  "Staying now": "Estadía en curso",
  "Check-in today": "Llegada hoy",
  "in {n} day": "en {n} día",
  "in {n} days": "en {n} días",
  Completed: "Completada",
  "{n} guest": "{n} huésped",
  "{n} guests": "{n} huéspedes",
  Door: "Puerta",
  Room: "Habitación",
  "View full details": "Ver todos los detalles",
  "This stay is complete — thank you for staying with us. 🏠": "Esta estadía terminó. Gracias por quedarte con nosotros. 🏠",
  "Book another room for these dates": "Reservar otra habitación para estas fechas",
  "Text {host} about this stay": "Escríbele a {host} sobre esta estadía",
};
