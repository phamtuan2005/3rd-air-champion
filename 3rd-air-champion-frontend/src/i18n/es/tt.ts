// Spanish for what TT says — see index.ts.
//
// TT talks like a helpful person at the door: short, warm, informal "tú",
// neutral Latin American Spanish as Airbnb writes to its guests (never "vos" or
// "vosotros"). Date EXAMPLES a guest is asked to type are written in Spanish,
// as the Chinese and Korean files' are: "10-12 de octubre", "este fin de
// semana", "3 de noviembre, 2 noches" — the forms TT's date reader is taught
// to read (dateText.ts, askTT.ts). An example the reader then fails on would be
// worse than none, so a new example here needs a test there.
//
// Room names ({room}) are never followed by an adjective that agrees in
// gender: "King" could be read as el or la. Lines say "está libre", "no está
// disponible" (both invariable) rather than "ocupada"/"reservada".
export const tt: Record<string, string> = {
  // ── Counting (the key is the English with its "s") ──
  "{n} night": "{n} noche",
  "{n} nights": "{n} noches",
  "{n} guest": "{n} huésped",
  "{n} guests": "{n} huéspedes",
  "{n} free night": "{n} noche libre",
  "{n} free nights": "{n} noches libres",
  // "Completo" is the house being sold out; on a wish-list button it reads as
  // "a night the house is full", which is what the guest is saving.
  "{n} full night": "{n} noche completa",
  "{n} full nights": "{n} noches completas",
  "{n} AirBnB review": "{n} reseña de AirBnB",
  "{n} AirBnB reviews": "{n} reseñas de AirBnB",

  // ── Buttons TT puts under an answer ──
  "Ask {host}": "Preguntarle a {host}",
  "Chat {host}": "Chatear con {host}",
  // "sin leer" carries no number agreement, so 1 and 5 read the same.
  " · {n} new": " · {n} sin leer",
  "Text {host}": "Enviar SMS a {host}",
  // {what} is a room name, "cualquier habitación", "estas 2 noches" or
  // "2 noches libres" — "Reservar" takes every one without an article.
  "Book {what} →": "Reservar {what} →",
  "Request {what} →": "Solicitar {what} →",
  "Choose {what}": "Elegir {what}",
  // In brackets, as Korean does: "para 10 oct – 12 oct" needs an article
  // Spanish cannot pick without knowing the span is one day or several.
  " for {span}": " ({span})",
  "any room": "cualquier habitación",
  // Only ever two or more nights (one night with a room free always has a
  // room for the whole stay), so the plural "estas" is safe.
  "these {nights}": "estas {nights}",
  // No article: {nights} can be "1 noche libre", and "las 1 noche" is wrong.
  "the {nights}": "{nights}",
  "★ Wish list the {nights}": "★ Guardar {nights} en tu lista de deseos",
  "This weekend": "Este fin de semana",
  "Next weekend": "El próximo fin de semana",
  "{room} this weekend": "{room} este fin de semana",
  "{room} next weekend": "{room} el próximo fin de semana",
  "Compare the rooms": "Comparar las habitaciones",
  "See {room}'s photos": "Ver las fotos de {room}",
  "Show {room}'s free nights": "Ver las noches libres de {room}",
  "Is {room} free this weekend?": "¿{room} está libre este fin de semana?",
  "What guests say about {room}": "Lo que dicen los huéspedes sobre {room}",
  "{room}'s latest review": "Reseña más reciente de {room}",
  "What guests say about the house": "Lo que dicen los huéspedes sobre la casa",
  "About {room}": "Sobre {room}",
  "{room} photos": "Fotos de {room}",
  "See my stays": "Ver mis estadías",
  "Open Your bookings": "Abrir “Tus reservas”",
  "My bookings": "Mis reservas",
  "My wish list": "Mi lista de deseos",
  "My wish list ({nights})": "Mi lista de deseos ({nights})",
  "Ask {host} about payment": "Preguntarle a {host} por el pago",
  "Ask {host} about a long stay": "Preguntarle a {host} por una estadía larga",
  "Talk to {host} about price": "Hablar del precio con {host}",
  "Ask {host} for a price": "Pedirle un precio a {host}",
  "Ask {host} about something else": "Preguntarle otra cosa a {host}",
  "Use the booking form": "Usar el formulario de reserva",
  "What's free this weekend?": "¿Qué hay libre este fin de semana?",
  "What guests say": "Lo que dicen los huéspedes",
  "Latest reviews": "Reseñas más recientes",
  "Book a stay": "Reservar una estadía",
  "Anything free this weekend?": "¿Hay algo libre este fin de semana?",
  "Which rooms fit 2?": "¿Qué habitaciones son para 2 personas?",
  "Parking": "Estacionamiento",
  "Check-in": "Check-in",
  "Cancellation": "Cancelación",

  // ── Which nights are free ──
  "{room} (your usual)": "{room} (tu habitación de siempre)",
  "{day} has already passed. Which dates are you thinking of next?": "{day} ya pasó. ¿Qué otras fechas tienes en mente?",
  "Those nights have already passed. Which dates are you thinking of next?": "Esas noches ya pasaron. ¿Qué otras fechas tienes en mente?",
  "{nights} you mentioned has already passed, so I've left it out.": "Ya pasó {nights} de las que mencionaste, así que la dejé fuera.",
  "{nights} you mentioned have already passed, so I've left them out.": "Ya pasaron {nights} de las que mencionaste, así que las dejé fuera.",
  "{day} is {holiday}": "{day} es {holiday}",
  "Heads up — {days}, a US holiday. Make sure you mean to stay that night.": "Un aviso — {days}, día festivo en EE. UU. Confirma que quieres quedarte esa noche.",
  "Heads up — {days}, a US holiday. Make sure you mean to stay those nights.": "Un aviso — {days}, días festivos en EE. UU. Confirma que quieres quedarte esas noches.",
  "That's {n} nights — I've looked at the first {max}. The calendar shows the rest.": "Son {n} noches — revisé las primeras {max}. El resto lo ves en el calendario.",
  "No single room here sleeps {n}. {host} can tell you how to split the party across two rooms.": "Ninguna habitación tiene lugar para {n} personas. {host} te puede decir cómo repartir el grupo en dos habitaciones.",
  "For {guests}: {rooms}.": "Para {guests}: {rooms}.",
  "{span} ({nights}): {room} is free ✓": "{span} ({nights}): {room} está libre ✓",
  // {rooms} can be one room or several, so no "libre(s)" to agree with it.
  "{span} ({nights}): free for the whole stay — {rooms}.": "{span} ({nights}): para toda la estadía — {rooms}.",
  "{span}: there's a room every night, but no one room for all {nights} — you'd move once. {each}.": "{span}: hay habitación cada noche, pero ninguna para las {nights} — tendrías que cambiarte una vez. {each}.",
  "{span}: {room} is taken.": "{span}: {room} no está disponible.",
  "{span}: sold out, I'm sorry.": "{span}: lo siento, está todo completo.",
  "Free instead for those nights: {rooms}.": "Esas noches sí hay lugar en: {rooms}.",
  "{span}: {room} is taken on {days}. Free: {free}.": "{span}: {room} no está disponible estos días: {days}. Disponible: {free}.",
  "{span}: sold out on {days}. Free: {free}.": "{span}: completo estos días: {days}. Disponible: {free}.",
  "a room": "una habitación",
  "{month}: {who} is free every night ✓": "{month}: {who} está libre todas las noches ✓",
  "{month}: {room} is taken every night, I'm sorry.": "{month}: lo siento, {room} no está disponible ninguna noche.",
  "{month}: sold out every night, I'm sorry.": "{month}: lo siento, está completo todas las noches.",
  "{month}: {who} is free on {free} of {n} nights. Taken: {taken}.": "{month}: {who} está libre {free} de {n} noches. Sin disponibilidad: {taken}.",
  // {example} is built in askTT.ts, which has no Spanish branch yet: until it
  // has, a Spanish guest is shown the English "Oct 10-12" here.
  "Tell me the nights — like “{example}” — and I'll book them.": "Dime las noches — por ejemplo, “{example}” — y las reservo.",

  // ── Booking ──
  "{room} sleeps up to {max}, so it can't take {n}.": "{room} es para {max} personas como máximo, así que no alcanza para {n}.",
  "Free for {guests} on those nights: {rooms}.": "Esas noches hay lugar para {guests} en: {rooms}.",
  "{host} can help you split the party across two rooms.": "{host} te puede ayudar a repartir el grupo en dos habitaciones.",
  "{room} is free — {stay}. Let's book it.": "{room} está libre — {stay}. Hagamos la reserva.",
  "{stay}. Free for the whole stay: {rooms}. Which room would you like?": "{stay}. Disponibles para toda la estadía: {rooms}. ¿Cuál prefieres?",
  "Check in {in} · check out {out} · {nights}": "Llegada {in} · salida {out} · {nights}",
  "phone ending {digits}": "teléfono terminado en {digits}",
  "Here's your request — check it, then I'll send it:": "Esta es tu solicitud — revísala y la envío:",
  "{guests} · under {name}, {phone}": "{guests} · a nombre de {name}, {phone}",
  "Includes {days}.": "Incluye {days}.",
  "{host} will text you the price for these nights.": "{host} te enviará el precio de estas noches por mensaje de texto.",
  // Family stay at $0 on purpose (CLAUDE.md) — said as agreed, never as a deal.
  "Family — no charge, as agreed with {host}.": "Familia — sin costo, como acordaste con {host}.",
  "Your price: ${rate}/night, as agreed with {host}.": "Tu precio: ${rate}/noche, como acordaste con {host}.",
  // Says what will happen (the host confirms, then the booking stands) rather
  // than "nothing is booked".
  "Nothing is booked until {host} confirms — you'll hear back by text.": "La reserva queda hecha cuando {host} la confirme — te responderá por mensaje de texto.",
  "Start over": "Empezar de nuevo",
  "How many guests? {room} sleeps up to {max}.": "¿Cuántos huéspedes serán? {room} es para {max} personas como máximo.",
  "Just me": "Solo yo",
  "What number should {host} text about it, {name}?": "¿A qué número te puede escribir {host}, {name}?",
  "Who should {host} text about it? Type your name and phone number — like “Mai, 408 555 0123”.": "¿A quién debe escribirle {host}? Pon tu nombre y tu teléfono — por ejemplo, “Mai, 408 555 0123”.",
  "And the name to put the request under?": "¿Y a nombre de quién va la solicitud?",
  "Heads up — your stay includes {days}, a US holiday. Do you mean to stay that night?": "Un aviso — tu estadía incluye {days}, día festivo en EE. UU. ¿Quieres quedarte esa noche?",
  "Heads up — your stay includes {days}, a US holiday. Do you mean to stay those nights?": "Un aviso — tu estadía incluye {days}, días festivos en EE. UU. ¿Quieres quedarte esas noches?",
  // "la"/"las" are the night(s) — "noche" is feminine.
  "Yes, keep it": "Sí, dejarla",
  "Yes, keep them": "Sí, dejarlas",
  "Leave it out": "Quitarla",
  "Leave them out": "Quitarlas",
  "Send (test — nothing is sent)": "Enviar (prueba — no se envía nada)",
  "Send to {host}": "Enviar a {host}",
  "I check out {day} instead": "Mejor salgo el {day}",
  "Not me — change name or number": "No soy yo — cambiar nombre o número",
  "Open in the booking form": "Abrir en el formulario de reserva",
  "{room} has just been taken for some of those nights. Here's what's free now:": "Acaban de reservar {room} para algunas de esas noches. Esto es lo que está libre ahora:",
  "That room has just been taken for some of those nights. Here's what's free now:": "Acaban de reservar esa habitación para algunas de esas noches. Esto es lo que está libre ahora:",
  "{room} — {stay}.": "{room} — {stay}.",
  "{room} was taken for some of those nights while we talked — nothing was sent. Want to look at other rooms?": "Mientras hablábamos, reservaron {room} para algunas de esas noches — no se envió nada. ¿Quieres ver otras habitaciones?",
  "What's free then?": "¿Qué hay libre en esas fechas?",
  "🧪 Test mode — nothing was sent to {host}. This is the request {host} would have received:": "🧪 Modo de prueba — no se envió nada a {host}. Esta es la solicitud que {host} habría recibido:",
  "Room: {room}": "Habitación: {room}",
  "Guests: {n}": "Huéspedes: {n}",
  "Name: {name} · {phone}": "Nombre: {name} · {phone}",
  // The note goes to the host in English (TIBOOK.md) — the label says so.
  "Note: {note}": "Nota (en inglés, para el anfitrión): {note}",
  "Try another booking": "Probar otra reserva",
  "Sent ✓ {host} has your request for {room} — {stay}.": "Enviada ✓ {host} ya tiene tu solicitud para {room} — {stay}.",
  "Nothing is booked until {host} confirms — you'll hear back by text. It's under Your bookings in the meantime.": "La reserva queda hecha cuando {host} la confirme — te responderá por mensaje de texto. Mientras tanto, la encuentras en “Tus reservas”.",
  "That didn't go through — the connection may have dropped. Nothing was sent.": "No se pudo enviar — puede que se haya cortado la conexión. No se envió nada.",
  "Try again": "Intentar de nuevo",
  "Done — {stay}.": "Listo — {stay}.",
  "Got it — {stay}.": "Entendido — {stay}.",
  "No problem — nothing was sent. Tell me other dates whenever you like.": "No hay problema — no se envió nada. Dime otras fechas cuando quieras.",
  "Thanks.": "Gracias.",
  "{room} sleeps up to {max}. For {n}, {host} can help split the party across two rooms.": "{room} es para {max} personas como máximo. Para {n}, {host} te puede ayudar a repartir el grupo en dos habitaciones.",
  "Thanks, {name}.": "Gracias, {name}.",
  "That number looks too short — type it with the area code, like 408 555 0123.": "Ese número parece muy corto — escríbelo con el código de área, por ejemplo 408 555 0123.",
  "Sorry, I didn't catch that.": "Perdón, no te entendí.",

  // ── Rooms ──
  "{room}: family — no charge, agreed with {host}.": "{room}: familia — sin costo, como acordaste con {host}.",
  "{room}: your price is ${rate}/night.": "{room}: tu precio es ${rate}/noche.",
  "{room} sleeps up to {max} · {beds}.": "{room}: hasta {max} personas · {beds}.",
  "{room} is one of the {n} rooms. {host} can tell you more about it.": "{room} es una de las {n} habitaciones. {host} te puede contar más.",
  "For {guests}:": "Para {guests}:",
  "There are {n} rooms:": "Hay {n} habitaciones:",
  "{room} — up to {max}, shared bathroom": "{room} — hasta {max} personas, baño compartido",
  "{room} — up to {max}, private bathroom": "{room} — hasta {max} personas, baño privado",
  "No single room here sleeps {n}. {host} can help you split the party across two.": "Ninguna habitación tiene lugar para {n} personas. {host} te puede ayudar a repartir el grupo en dos.",
  "Pick a room to see its photos:": "Elige una habitación para ver sus fotos:",

  // ── What guests say ──
  "{room}'s latest review — {when}:": "Reseña más reciente de {room} — {when}:",
  "I don't have {room}'s latest review yet.": "Todavía no tengo la reseña más reciente de {room}.",
  "Here's what guests say about {room} overall:": "Esto opinan los huéspedes sobre {room} en general:",
  "{host} can tell you what the last guests thought.": "{host} te puede contar qué les pareció a los últimos huéspedes.",
  "I don't have the latest reviews yet — {host} can tell you what recent guests thought.": "Todavía no tengo las reseñas más recientes — {host} te puede contar qué les pareció a los huéspedes recientes.",
  "The latest review of each room:": "La reseña más reciente de cada habitación:",
  "Rated {rating} ★ across {reviews}.": "Calificación de {rating} ★ en {reviews}.",
  "What guests say about {room}:": "Lo que dicen los huéspedes sobre {room}:",
  "I don't have a summary of {room}'s reviews yet.": "Todavía no tengo un resumen de las reseñas de {room}.",
  // "sobre la casa", not "de la casa": "los huéspedes de la casa" reads as the
  // people staying there now.
  "Here's what guests say about the house:": "Esto dicen los huéspedes sobre la casa:",
  "{host} can tell you what guests think of it.": "{host} te puede contar qué opinan los huéspedes.",
  "I don't have a summary of the reviews yet — {host} can tell you what guests say.": "Todavía no tengo un resumen de las reseñas — {host} te puede contar qué dicen los huéspedes.",
  "What guests say about TT House:": "Lo que dicen los huéspedes sobre TT House:",
  "{n} out of 5 stars": "{n} de 5 estrellas",

  // ── Questions guests usually text the host ──
  "Tell me the extra nights — like “Oct 13-14” — and I'll check your room is free and book them.": "Dime las noches extra — por ejemplo, “13-14 de octubre” — y reviso que tu habitación esté libre y las reservo.",
  "TT House is flexible when plans change — tell {host} what's happening and you'll work it out together.": "TT House es flexible cuando cambian los planes — cuéntale a {host} qué pasa y lo resuelven juntos.",
  // "Holds" are reserved, unpaid stays (CLAUDE.md): "apartadas" says the room
  // is set aside for the guest, which is what a hold is to them.
  "Your stays, holds and wish list are all under Your bookings — just your phone number opens them.": "Tus estadías, reservas apartadas y lista de deseos están en “Tus reservas” — se abren solo con tu número de teléfono.",
  "{host} can tell you whether your bags can stay before check-in or after check-out.": "{host} te dirá si puedes dejar tus maletas antes del check-in o después del check-out.",
  // "Llegada autónoma" is Airbnb's Spanish for self check-in.
  "Every room has self check-in.": "Todas las habitaciones tienen llegada autónoma.",
  "Your door code and the address come in Your bookings once your stay is confirmed.": "El código de la puerta y la dirección aparecen en “Tus reservas” en cuanto se confirme tu estadía.",
  "{host} will confirm your check-in and check-out times with your booking.": "{host} te confirmará los horarios de check-in y check-out con tu reserva.",
  // The small-hours rule has already cost the house a room (CLAUDE.md): the
  // capitals stay, as in English.
  "Arriving after midnight? Book the night BEFORE — 1am Tuesday is the Monday night. If you're unsure, {host} will sort it out.": "¿Llegas después de medianoche? Reserva la noche ANTERIOR — la 1 a. m. del martes es la noche del lunes. Si tienes dudas, {host} lo resuelve contigo.",
  // An EV charger: askTT.ts answers this to "ev", "tesla", "charging".
  "None of the listings mention a charger — {host} will know.": "Ningún anuncio menciona un cargador para autos eléctricos — {host} lo sabrá.",
  "{host} sorts out payment with you directly — ask about it in a message and you'll have a straight answer.": "{host} arregla el pago directamente contigo — pregúntale en un mensaje y te dará una respuesta clara.",
  "Tell me the dates — like “Nov 1 for 30 nights” — and I'll check a room is free the whole time.": "Dime las fechas — por ejemplo, “1 de noviembre, 30 noches” — y reviso que haya una habitación libre todo ese tiempo.",
  "The rate for a longer stay is agreed with {host}: send the dates and {host} will come back with one.": "La tarifa para estadías largas se acuerda con {host}: envía las fechas y {host} te dará una.",
  "You can ask for any number of nights here, even one. {host} confirms each request.": "Aquí puedes pedir las noches que quieras, incluso una sola. {host} confirma cada solicitud.",
  "Your prices, agreed with {host}:": "Tus precios, acordados con {host}:",
  "The price is something you settle with {host} directly — send your dates and {host} will give you a rate.": "El precio lo acuerdas directamente con {host} — envía tus fechas y {host} te dará una tarifa.",
  "Mini fridge in: {rooms}.": "Minirrefrigerador en: {rooms}.",
  "Microwave in: {rooms}.": "Microondas en: {rooms}.",
  "Coffee maker in: {rooms}.": "Cafetera en: {rooms}.",
  "Private bathroom: {rooms}.": "Baño privado: {rooms}.",
  "Shared bathroom with a bathtub and hot water: {rooms}.": "Baño compartido con bañera y agua caliente: {rooms}.",
  "The house rules:": "Las reglas de la casa:",
  "{host} will tell you straight — just ask.": "{host} te lo dirá con claridad — solo pregunta.",
  "TT House is in Silicon Valley. The exact address comes in Your bookings once your stay is confirmed.": "TT House está en Silicon Valley. La dirección exacta aparece en “Tus reservas” en cuanto se confirme tu estadía.",
  "{host} can tell you how to get here from the airport or the station.": "{host} te puede decir cómo llegar desde el aeropuerto o la estación.",
  "{host} knows the area best and will answer that — send a message.": "{host} conoce la zona mejor que nadie y te responderá — envíale un mensaje.",
  "{host} lives here and reads every message personally.": "{host} vive aquí y lee cada mensaje personalmente.",
  "Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and I'll book them in {room}, or any room that's free. You check the request before it's sent.": "Dime tus fechas — por ejemplo, “10-12 de octubre”, “este fin de semana” o “3 de noviembre, 2 noches” — y las reservo en {room} o en cualquier habitación libre. Revisas la solicitud antes de que se envíe.",
  "Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and I'll book them. You check the request before it's sent.": "Dime tus fechas — por ejemplo, “10-12 de octubre”, “este fin de semana” o “3 de noviembre, 2 noches” — y las reservo. Revisas la solicitud antes de que se envíe.",
  "Happy to book it for you. Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and how many of you there are.": "Con gusto te hago la reserva. Dime tus fechas — por ejemplo, “10-12 de octubre”, “este fin de semana” o “3 de noviembre, 2 noches” — y cuántas personas son.",
  "You'll see the whole request before anything is sent.": "Verás la solicitud completa antes de que se envíe nada.",
  "Hello! Ask me about dates, rooms, parking, check-in — anything about staying here.": "¡Hola! Pregúntame por fechas, habitaciones, estacionamiento, check-in — todo sobre tu estadía aquí.",
  // The motto stays in English, as the house wrote it, and is named as the
  // house's promise to the guest (CLAUDE.md, Tone).
  "You're welcome. “Your comfort. Our mission.” is TT House's promise to you.": "De nada. “Your comfort. Our mission.” es la promesa de TT House para ti.",
  // "Nov Mon-Tue" is every Monday and Tuesday of November. The Spanish example
  // names one weekday, as the Korean does: TT reads "los lunes de noviembre"
  // as every Monday in November, and a second weekday would be dropped.
  "Your wish list is empty. Tell me the dates you'd like — “Oct 10-12”, “Nov Mon-Tue” — and I'll check them.": "Tu lista de deseos está vacía. Dime qué fechas te gustarían — “10-12 de octubre”, “los lunes de noviembre” — y las reviso.",
  "I'm not sure I understood that. {host} can answer it — or try dates like “Oct 10-12”, a room name, or “parking”.": "No sé si te entendí bien. {host} te puede responder — o prueba con fechas como “10-12 de octubre”, el nombre de una habitación o “estacionamiento”.",

  // ── Privacy ──
  "Your host is {host}, who lives here.": "Tu anfitrión es {host}, que vive aquí.",
  "That's not something I can help with. I'm TT House's booking helper — I can tell you about the rooms, which nights are free, and staying here.": "En eso no te puedo ayudar. Soy el asistente de reservas de TT House — te puedo contar sobre las habitaciones, qué noches están libres y cómo es quedarse aquí.",
  "I never give out door codes, passwords or PINs.": "Nunca doy códigos de puerta, contraseñas ni PIN.",
  "Once your stay is confirmed, your own check-in details are in Your bookings, opened with your phone number.": "En cuanto se confirme tu estadía, los datos de tu llegada estarán en “Tus reservas”, que se abre con tu número de teléfono.",
  "I don't share anyone's contact details. To reach {host}, send a message here — it goes straight to {host}.": "No comparto los datos de contacto de nadie. Para hablar con {host}, envía un mensaje aquí — le llega directo a {host}.",
  "I keep everyone at TT House private — guests, the host and the team. I can't say who is staying, who booked, or anything about them.": "En TT House cuido la privacidad de todos — huéspedes, anfitrión y equipo. No puedo decir quién se hospeda, quién reservó ni nada sobre ellos.",
  "I can tell you which rooms are free on your dates.": "Te puedo decir qué habitaciones están libres en tus fechas.",

  // ── What every room's listing says (roomFacts.ts / the amenities TT knows) ──
  // Lowercase, with the article the English has ("una TV", "un clóset"): each
  // goes inside a sentence — "tienen {thing}", "menciona {thing}" — where
  // Spanish wants it. The "Rooms with" line is turned round ("Tienen …:") so
  // "con un ventilador" is never needed.
  "wifi": "wifi",
  "air conditioning": "aire acondicionado",
  "heating": "calefacción",
  "a TV": "una TV",
  "a dedicated workspace": "un espacio de trabajo",
  "a fan": "un ventilador",
  "a lock on the door": "cerradura en la puerta",
  "outdoor space": "espacio al aire libre",
  "towels and bed linen": "toallas y ropa de cama",
  "a hair dryer": "una secadora de pelo",
  "toiletries": "artículos de aseo",
  "a washer or dryer": "lavadora o secadora",
  "an iron": "una plancha",
  "extra blankets and pillows": "cobijas y almohadas extra",
  "a closet": "un clóset",
  "blackout curtains": "cortinas opacas",
  "a window": "una ventana",
  "a crib": "una cuna",
  "a gym": "un gimnasio",
  "a pool or hot tub": "piscina o jacuzzi",
  "breakfast": "desayuno",
  "step-free access": "acceso sin escalones",
  "Every room has {thing} ✓": "Todas las habitaciones tienen {thing} ✓",
  "{rooms}'s listing mentions {thing}. The others don't say — {host} can confirm.": "El anuncio de {rooms} menciona {thing}. Los demás no lo dicen — {host} te lo puede confirmar.",
  "Rooms with {thing}: {rooms}.": "Tienen {thing}: {rooms}.",
  "None of the room listings mention {thing} — {host} will know for sure.": "Ningún anuncio de las habitaciones menciona {thing} — {host} lo sabrá con seguridad.",

  // ── The sheet itself ──
  // "Ask TT" is a NAME, like TiBook — kept English on purpose (Anh-Tri,
  // 2026-10-21), so it is deliberately not in this dictionary.
  "Ask TT, your booking helper": "Ask TT, tu asistente de reservas",
  "New here? Meet TT, your AI helper.": "¿Primera vez aquí? Te presentamos a TT, tu asistente con IA.",
  "Ask about the rooms, parking or your dates, and TT will walk you through booking.": "Pregunta por las habitaciones, el estacionamiento o tus fechas, y TT te guía para reservar.",
  // "Hola de nuevo", not "Bienvenido/a": TiBook does not know the guest's
  // gender, and "hola de nuevo" needs none.
  "Welcome back, {name}.": "Hola de nuevo, {name}.",
  "Welcome back.": "Hola de nuevo.",
  "Tell TT your dates and it sets up the request — in your usual room when it's free.": "Dile tus fechas a TT y prepara la solicitud — en tu habitación de siempre si está libre.",
  "Dismiss": "Cerrar",
  "Book with TT": "Reservar con TT",
  "TT House's assistant · answers from this page": "Asistente de TT House · responde con lo que dice esta página",
  "Bookings made here are shown, not sent to the host": "Las reservas hechas aquí solo se muestran, no se envían al anfitrión",
  "Test mode": "Modo de prueba",
  "Close": "Cerrar",
  // These greetings are built from pieces (AskTT.tsx): this line, then " en ",
  // the rooms joined by ", " and " o ", then one of the endings below, then
  // " — revisas la solicitud…". Each piece is worded to read on as one sentence.
  "Welcome back, {name}! TT is your assistant. Tell me your dates and I'll book them": "¡Hola de nuevo, {name}! TT es tu asistente. Dime tus fechas y las reservo",
  "Welcome back! TT is your assistant. Tell me your dates and I'll book them": "¡Hola de nuevo! TT es tu asistente. Dime tus fechas y las reservo",
  " in ": " en ",
  " or ": " o ",
  ", the room you stayed in last time": ", la habitación donde te quedaste la última vez",
  " — the rooms you stay in, in that order": " — las habitaciones donde sueles quedarte, en ese orden",
  ", your usual room": ", tu habitación de siempre",
  " — you check the request before it's sent.": " — revisas la solicitud antes de que se envíe.",
  "Hello {name}, TT is your assistant. I will do my best to assist you. What can I do for you today?": "Hola, {name}. TT es tu asistente. Haré todo lo posible por ayudarte. ¿Qué puedo hacer por ti hoy?",
  "Hello, TT is your assistant. I will do my best to assist you. What can I do for you today?": "Hola, TT es tu asistente. Haré todo lo posible por ayudarte. ¿Qué puedo hacer por ti hoy?",
  "New to TT House? Ask me anything — the rooms, parking, check-in. When you're ready, say “book Oct 10-12” or “book this weekend for 2” and I'll book it for you. You see the whole request before anything is sent.": "¿Primera vez en TT House? Pregúntame lo que quieras — las habitaciones, el estacionamiento, el check-in. Cuando quieras, escribe “reservar 10-12 de octubre” o “reservar este fin de semana para 2 personas” y yo hago la reserva. Verás la solicitud completa antes de que se envíe nada.",
  // The motto stays in English, as the house wrote it, and is named as the
  // house's promise to the guest (CLAUDE.md, Tone).
  "“Your comfort. Our mission.” — TT House's promise to you": "“Your comfort. Our mission.” — la promesa de TT House para ti",
  "Your questions are kept, without any phone number or email in them, so TT House can teach TT what guests ask.": "Tus preguntas se guardan, sin números de teléfono ni correos, para que TT House pueda enseñarle a TT lo que preguntan los huéspedes.",
  "Your name and phone number": "Tu nombre y número de teléfono",
  "Your name": "Tu nombre",
  "Ask, or say “book Oct 10-12”…": "Pregunta o escribe “reservar 10-12 de octubre”…",
  "Ask": "Preguntar",
  "You have {n} night on your wish list — I can check them all at once.": "Tienes {n} noche en tu lista de deseos — puedo revisarla ahora mismo.",
  "You have {n} nights on your wish list — I can check them all at once.": "Tienes {n} noches en tu lista de deseos — puedo revisarlas todas a la vez.",
};
