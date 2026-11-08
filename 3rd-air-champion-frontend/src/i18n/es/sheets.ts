// Spanish for TiBook's sheets screens — see index.ts.
// Your Bookings, the wish list (popup, modal, summary), the "usual stay" card
// for returning guests, and the chat with the host.
// Neutral Latin American Spanish, "tú". A stay is "estadía", as Airbnb writes
// it for Latin America ("estancia" reads as Spain).
export const sheets: Record<string, string> = {
  // ── Your Bookings (MyBookingsSheet) ──────────────────────────────────────
  "Check-in instructions": "Instrucciones de llegada",
  "Could not load bookings. Please try again.": "No pudimos cargar tus reservas. Inténtalo de nuevo.",
  Room: "Habitación",
  // The event in the guest's own phone calendar (.ics).
  "Stay at {room}": "Estadía en {room}",
  "{n} night at {room}": "{n} noche en {room}",
  "{n} nights at {room}": "{n} noches en {room}",
  // "Estadía en curso", not "Hospedado ahora": that would guess the guest's
  // gender.
  "Staying now": "Estadía en curso",
  "Check-in today": "Llegada hoy",
  Pending: "Pendiente",
  Confirmed: "Confirmada",
  // Held, not paid — "Reservada" would read as the same thing as Confirmada.
  Reserved: "Apartada",
  "{n} night": "{n} noche",
  "{n} nights": "{n} noches",
  "Tomorrow!": "¡Mañana!",
  "in {n} days": "en {n} días",
  "${rate}/night": "${rate}/noche",
  " + ${sum} fees": " + ${sum} en cargos",
  Fee: "Cargo",
  Discount: "Descuento",
  "${sum} off this stay": "${sum} de descuento en esta estadía",
  "Address · tap for directions": "Dirección · toca para ver cómo llegar",
  "Room code": "Código de la habitación",
  "Your Bookings": "Tus reservas",
  "Loading your bookings…": "Cargando tus reservas…",
  "Your phone number": "Tu número de teléfono",
  Search: "Buscar",
  "Showing bookings for": "Reservas de",
  "Not you?": "¿No eres tú?",
  "We couldn't find any bookings for this number. Please double-check the number you used when booking.":
    "No encontramos reservas con este número. Revisa que sea el número que usaste al reservar.",
  "No upcoming bookings. We look forward to having you again!":
    "No tienes reservas próximas. ¡Nos encantará recibirte de nuevo!",
  Upcoming: "Próximas",
  "Add my stays to calendar": "Agregar mis estadías al calendario",
  "House rules": "Reglas de la casa",
  "Wish list dates": "Fechas en tu lista de deseos",
  "Remove {date}?": "¿Quitar {date}?",
  "Please search your bookings first so we can verify your identity.":
    "Primero busca tus reservas, así confirmamos que eres tú.",
  "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "Yes, remove": "Sí, quitar",
  Keep: "Conservar",
  "TiBook visitor numbers": "Visitas de TiBook",
  "How many people are looking, and from where": "Cuántas personas están mirando, y desde dónde",

  // ── Wish list (WishListModal, WishListSummarySheet, WishListDatePopup) ────
  "Please enter your phone number and name.": "Escribe tu número de teléfono y tu nombre.",
  "Remove from Wish List": "Quitar de la lista de deseos",
  "Add to Wish List": "Agregar a la lista de deseos",
  "This date is on your wish list. Tap below to remove it.":
    "Esta fecha está en tu lista de deseos. Toca abajo para quitarla.",
  "Sold out for now — we'll keep this date saved for you.": "Completo por ahora — te guardamos esta fecha.",
  "looking up...": "buscando...",
  "✓ found": "✓ encontrado",
  edit: "editar",
  "Your name": "Tu nombre",
  "Save to Wish List": "Guardar en la lista de deseos",
  "No dates selected.": "No elegiste ninguna fecha.",
  "My Wish List — {n} date": "Mi lista de deseos — {n} fecha",
  "My Wish List — {n} dates": "Mi lista de deseos — {n} fechas",
  "No dates saved yet.": "Todavía no guardaste ninguna fecha.",
  "Sent ✓": "Enviado ✓",
  "Sending...": "Enviando...",
  "Send to host →": "Enviar al anfitrión →",
  "That didn't go through. Please try again.": "No se pudo enviar. Inténtalo de nuevo.",
  // Thrown by TiBook.tsx and shown by WishListDatePopup.
  "Open Your Bookings with your phone number first, then try again.":
    "Primero abre “Tus reservas” con tu número de teléfono y vuelve a intentarlo.",
  "On your wish list": "En tu lista de deseos",
  Close: "Cerrar",
  "This night is sold out, and it's saved on your wish list. We'll let you know as soon as a room opens up.":
    "Esta noche está completa y ya está en tu lista de deseos. Te avisaremos en cuanto se libere una habitación.",
  "Keep waiting": "Seguir esperando",
  "Removing…": "Quitando…",
  "Remove from wish list": "Quitar de la lista de deseos",

  // ── A wished-for night is free (WishFreeCard) ────────────────────────────
  "A night you wished for is free": "Una noche de tu lista de deseos está libre",
  "Nights you wished for are free": "Hay noches de tu lista de deseos libres",
  "Rooms go to whoever asks first. Book it puts these nights into your request — you check it and send it.":
    "La habitación es para quien la pide primero. “Reservar” pone estas noches en tu solicitud — tú la revisas y la envías.",
  "Book it": "Reservar",

  // ── Chat with the host (HostChatSheet) ───────────────────────────────────
  "Could not load your messages just now.": "No pudimos cargar tus mensajes en este momento.",
  "A phone number lets him write back — please add yours.":
    "Con tu número de teléfono, él te puede responder — agrégalo, por favor.",
  "That did not send. Your message is still here — try again?":
    "No se envió. Tu mensaje sigue aquí — ¿lo intentas de nuevo?",
  "Your host. He reads these himself.": "Tu anfitrión. Él mismo lee tus mensajes.",
  "Ask {host} anything about the house.": "Pregúntale a {host} lo que quieras sobre la casa.",
  "Parking, the kitchen, a late arrival, what a room is really like — whatever you would like to know before you book. Your message goes straight to him and his reply comes back here.":
    "El estacionamiento, la cocina, una llegada tarde, cómo es de verdad una habitación — lo que quieras saber antes de reservar. Tu mensaje le llega directo a él y su respuesta llega aquí.",
  You: "Tú",
  "Your host": "Tu anfitrión",
  "Sending…": "Enviando…",
  "Read by {host}": "Leído por {host}",
  Sent: "Enviado",
  "{host} is typing": "{host} está escribiendo",
  "Your phone": "Tu teléfono",
  "Write to {host}…": "Escríbele a {host}…",
  Send: "Enviar",
  "Show me when {host} has read my messages": "Avísame cuando {host} lea mis mensajes",
  "In a hurry?": "¿Tienes prisa?",
  "Call {host}": "Llama a {host}",
  or: "o",
  "text his phone": "mándale un mensaje de texto",

  // ── Returning guests (UsualStayCard) ─────────────────────────────────────
  // The same keys as calendar.ts, and this file is spread after it, so these
  // win: lowercase to match, as Spanish writes a weekday mid-sentence. The
  // card's "los martes por la noche" is built whole in nightsPhraseEs.
  Monday: "lunes",
  Tuesday: "martes",
  Wednesday: "miércoles",
  Thursday: "jueves",
  Friday: "viernes",
  Saturday: "sábado",
  Sunday: "domingo",
  " and ": " y ",
  " every other week": " cada dos semanas",
  " every third week": " cada tres semanas",
  " every fourth week": " cada cuatro semanas",
  // A no-break space, as in the English: "2 noches" never splits over a line.
  ", {n} night": ", {n} noche",
  ", {n} nights": ", {n} noches",
  "Tap to open · drag to move": "Toca para abrir · arrastra para mover",
  // Two lines on screen, and the second is shared by one stay and many, so it
  // is "esperándote" — no adjective to agree with the number.
  "TT has {n} stay": "TT tiene {n} estadía",
  "TT has {n} stays": "TT tiene {n} estadías",
  "lined up for you": "esperándote",
  "Stays to book ahead": "Estadías para reservar con anticipación",
  // "Hola de nuevo", not "Bienvenido/a de nuevo": no guessing the guest's
  // gender from a name.
  "Welcome back, {name}": "Hola de nuevo, {name}",
  "Welcome back": "Hola de nuevo",
  Minimise: "Minimizar",
  "Last time you stayed {nights}": "La última vez te quedaste {nights}",
  "Want the same again? These are open in the coming weeks:":
    "¿Lo mismo otra vez? Estas fechas están libres en las próximas semanas:",
  "TT noted that you usually stay {nights}": "TT notó que sueles quedarte {nights}",
  "You're booked up to {date}.": "Tienes reservas hasta el {date}.",
  "TT can line up the next ones for you, to {month}": "TT puede prepararte las siguientes, hasta {month}",
  " — {room} is already booked {taken} of the next {known} weeks on those nights":
    " — {room} ya está ocupada esas noches en {taken} de las próximas {known} semanas",
  "Untick any week you won't need.": "Desmarca las semanas que no necesites.",
  "Request {n} stay": "Solicitar {n} estadía",
  "Request {n} stays": "Solicitar {n} estadías",
  "Request all {n} stay": "Solicitar {n} estadía",
  "Request all {n} stays": "Solicitar las {n} estadías",
  "All selected": "Todas seleccionadas",
  "None selected": "Ninguna seleccionada",
  "{k} of {n} nights selected": "{k} de {n} noches seleccionadas",
  "{dates} in {room}": "{dates} en {room}",
  "the room": "la habitación",
  // The day comes after the start: weekdays are lowercase, and "martes está
  // lleno" would open a sentence with a small letter.
  "{days} is full that week": "Esa semana, el {days} está completo",
  "{days} are full that week": "Esa semana están completos: {days}",
  "Done choosing": "Listo",
  "{k} of {n} nights — change": "{k} de {n} noches — cambiar",
  "Choose nights": "Elegir noches",
  "adds to your {days} stay": "completa tu estadía del {days}",
  " — in {room}, as {theirs} is taken that night": " — en {room}, porque {theirs} está ocupada esa noche",
  "your room": "tu habitación",
  "You'll see the request before anything is sent — each stay goes to the host on its own.":
    "Verás la solicitud antes de que se envíe nada — cada estadía le llega al anfitrión por separado.",
  "Not now": "Ahora no",
  Resize: "Cambiar tamaño",
  "Stays TT lined up for you": "Estadías que TT preparó para ti",
  "{n} stay": "{n} estadía",
  "{n} stays": "{n} estadías",
};
