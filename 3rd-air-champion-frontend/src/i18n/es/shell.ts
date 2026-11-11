// Spanish for TiBook's shell screens — see index.ts.
// Neutral Latin American Spanish, informal "tú", worded like Airbnb writes to
// Spanish-speaking guests: anfitrión, huésped, reserva, lista de deseos.
export const shell: Record<string, string> = {
  Language: "Idioma",

  // House facts strip
  "Stay with {name}, an engineer living here": "Hospédate con {name}, un ingeniero que vive aquí",
  "your host": "tu anfitrión",
  "Smart toilet, warm seat, bidet, all bathrooms": "Inodoro inteligente con asiento térmico y bidé en todos los baños",

  // Remember-me question
  // "If you say yes, we'll keep" is followed by the phone number, then the
  // long line starting "and your name…", so the three read as one sentence.
  "Save your number on this device?": "¿Guardar tu número en este dispositivo?",
  "So you don't have to type it again": "Así no tendrás que escribirlo otra vez",
  "If you say yes, we'll keep": "Si dices que sí, guardaremos",
  "and your name in this browser's storage on your own phone or computer. Next time you open TiBook, your stays, your wish list and your rate are already here.":
    "y tu nombre en el almacenamiento de este navegador, en tu propio teléfono o computadora. La próxima vez que abras TiBook, tus estadías, tu lista de deseos y tu tarifa ya estarán aquí.",
  "It stays on this device — it isn't a tracking cookie and no one else can read it.":
    "Se queda en este dispositivo: no es una cookie de rastreo y nadie más puede leerlo.",
  "Your booking request reaches the house either way — this is only about saving you the typing next visit.":
    "Tu solicitud de reserva llega a la casa de cualquier forma; esto solo te ahorra escribir en tu próxima visita.",
  "Change your mind whenever you like: \"Not you?\" in Your Bookings clears your number and this choice from this device, and we'll ask again next time.":
    "Puedes cambiar de opinión cuando quieras: \"¿No eres tú?\" en Tus reservas borra tu número y esta elección de este dispositivo, y te volveremos a preguntar la próxima vez.",
  "Yes, remember me": "Sí, recuérdame",
  "No, just for this visit": "No, solo esta visita",

  // Loyalty welcome
  "Hi {name}! Welcome back": "¡Hola, {name}! Qué gusto verte de nuevo",
  "Cherished Guest": "Huésped muy querido",
  "Valued Guest": "Huésped apreciado",
  "Loyal Guest": "Huésped fiel",
  "Returning Guest": "Huésped que regresa",
  "{n} stay": "{n} estadía",
  "{n} stays": "{n} estadías",
  "{n} night": "{n} noche",
  "{n} nights": "{n} noches",
  "with us since {date}": "con nosotros desde {date}",
  "Thank you — you have ${amount} off every night": "Gracias: tienes ${amount} de descuento cada noche",
  "It is already taken off the totals below. Our way of saying we are glad you keep coming back.":
    "Ya está descontado de los totales de abajo. Es nuestra forma de decirte que nos alegra que sigas volviendo.",
  "You are not just a guest, you are part of the TT House family. We hold every single one of those nights close to our hearts, and your trust in us means everything. Thank you for being so wonderfully you.":
    "No eres solo un huésped: eres parte de la familia de TT House. Guardamos cada una de esas noches en el corazón, y tu confianza lo es todo para nosotros. Gracias por ser tan maravillosamente tú.",
  "You have truly made TT House your home away from home. We are so grateful you keep choosing us, and we will always do our best to deserve that trust.":
    "TT House de verdad se ha vuelto tu hogar lejos de casa. Te agradecemos muchísimo que sigas eligiéndonos, y siempre haremos lo mejor para merecer esa confianza.",
  "Every time you come back, it genuinely warms our hearts. You are a true friend of TT House, and we look forward to many more stays together.":
    "Cada vez que regresas, de verdad nos alegra el corazón. Eres un verdadero amigo de TT House y esperamos compartir muchas estadías más contigo.",
  "It means so much to have you back! We hope every stay with us feels like a little retreat — comfortable, warm, and just right. See you again soon!":
    "¡Nos encanta tenerte de vuelta! Esperamos que cada estadía con nosotros se sienta como un pequeño descanso: cómodo, cálido y justo como lo necesitas. ¡Hasta pronto!",
  "Welcome to TT House! We are so happy you are here, and we hope this stay is the first of many. Your comfort is truly our mission.":
    "¡Bienvenido a TT House! Nos alegra mucho que estés aquí y esperamos que esta sea la primera de muchas estadías. Tu comodidad es de verdad nuestra misión.",

  // Host contact button
  // "Ask TT" as a whole is a name and stays English elsewhere; here {name} is
  // the host's name inside an ordinary sentence, so the verb is translated
  // around it, as German ("Frag {name}") and Korean do.
  "Ask {name}": "Pregúntale a {name}",
  "Anything at all — he answers these himself.": "Lo que quieras: él mismo te responde.",
  "Chat here": "Chatear aquí",
  "Stays in TiBook. {name} replies on this screen.": "Se queda en TiBook. {name} te responde en esta pantalla.",
  "Text his phone": "Enviarle un mensaje de texto",
  "Opens your messages, ready to send.": "Abre tus mensajes, listo para enviar.",
  "Call him": "Llamarlo",
  "Rings his phone now.": "Llama a su teléfono ahora.",
  "Chat is the quickest way to reach him today.": "Hoy, el chat es la forma más rápida de contactarlo.",
  "Ask {name} — drag me anywhere": "Pregúntale a {name}: arrástrame a donde quieras",
  "Contact {name}. Drag to move this button.": "Contactar a {name}. Arrastra para mover este botón.",

  // Host banner
  // The short banner motto is translated, as German and Korean did.
  "Verified": "Verificado",
  "Superhost": "Superanfitrión",
  "Superhosts": "Superanfitriones",
  "Your Comfort. Our Mission.": "Tu comodidad. Nuestra misión.",
  "{n} reviews": "{n} reseñas",
  // Highlight pills the host types in TiMag, in English. Kept chip-short.
  // "Kaiser" alone means nothing to a Spanish speaker; it is Kaiser
  // Permanente's hospital in Santa Clara, so say so.
  "Near big techs": "Cerca de grandes tecnológicas",
  "Modern design": "Diseño moderno",
  "Safe neighborhoods": "Vecindario seguro",
  "Clean & Comfortable": "Limpio y cómodo",
  "Near Kaiser": "Cerca del hospital Kaiser",
  "Near Levi's Stadium": "Cerca del Levi's Stadium",
  "Sunset view": "Vista al atardecer",

  // Room cards
  "Family — no charge": "Familia: sin costo",
  "/night": "/noche",
  "View {room} on AirBnB": "Ver {room} en AirBnB",
  "the host": "el anfitrión",
  "All": "Todas",
  "Show room photos": "Ver fotos de las habitaciones",
  "Photos": "Fotos",
  "Our Rooms": "Nuestras habitaciones",
  "tap on room name to select": "toca el nombre de una habitación para elegirla",
  "Every price is agreed between you and {name}. Open a room to ask.": "Cada precio lo acuerdas directamente con {name}. Abre una habitación para preguntar.",
  // Nightly price ranges for a guest with no agreed rate (util/priceRange).
  "Prices are flexible nightly ranges. Open a room to find one that works for you and {name}.": "Los precios son rangos flexibles por noche. Abre una habitación para encontrar con {name} uno que les funcione a los dos.",
  "Your agreed prices are shown; the others are ranges. Open a room to ask {name}.": "Se muestran tus precios acordados; los demás son rangos. Abre una habitación para preguntarle a {name}.",
  "/ night · flexible": "/ noche · flexible",
  "This room is {range} a night. Tell {name} your dates and you'll find a price that works for you both.": "Esta habitación cuesta {range} por noche. Dile a {name} tus fechas y encontrarán un precio que les funcione a los dos.",
  "These are your prices, agreed with {name}.": "Estos son tus precios, acordados con {name}.",
  "Your agreed prices are shown. Open a room without one to ask {name}.": "Se muestran tus precios acordados. Abre una habitación sin precio para preguntarle a {name}.",
  "Hide room photos": "Ocultar fotos de las habitaciones",
  "Hide": "Ocultar",
  "All Rooms": "Todas las habitaciones",

  // Room gallery
  // "for this room, agreed with {name}." follows "Family — no charge", and
  // "Your price for this room is" is followed by the price, then
  // " with your loyalty discount", then ", agreed with {name}." — one sentence.
  "Close": "Cerrar",
  "Enlarge this picture": "Ampliar esta foto",
  "Enlarge": "Ampliar",
  "See more on AirBnB": "Ver más en AirBnB",
  "Accommodates up to {n}": "Hasta {n} huéspedes",
  "The price here is something you can settle with {name} directly.": "El precio de esta habitación lo puedes acordar directamente con {name}.",
  "for this room, agreed with {name}.": "por esta habitación, acordado con {name}.",
  "Your price for this room is": "Tu precio por esta habitación es",
  " with your loyalty discount": " con tu descuento por fidelidad",
  ", agreed with {name}.": ", acordado con {name}.",
  "Chat here in TiBook": "Chatear aquí en TiBook",
  "Works from any country, on any phone — {name} replies on this screen.": "Funciona desde cualquier país y en cualquier teléfono: {name} te responde en esta pantalla.",
  "Text {name}": "Enviarle un mensaje a {name}",
  "Ask {name} about the price": "Preguntarle el precio a {name}",
  "Back to the room": "Volver a la habitación",
  "Previous picture": "Foto anterior",
  "Next picture": "Foto siguiente",
  "Tap twice to go back": "Toca dos veces para volver",

  // Room facts (src/util/roomFacts.ts) — the English stays the source there,
  // because askTT reads it; these are only how the gallery draws it. The two
  // bathroom keys hold a no-break space before the dash, as roomFacts does.
  "1 queen bed": "1 cama queen",
  "1 sofa bed": "1 sofá cama",
  "1 double bed": "1 cama matrimonial",
  "Private attached bathroom, with a smart toilet — warm seat and built-in bidet":
    "Baño privado dentro de la habitación, con inodoro inteligente: asiento térmico y bidé integrado",
  "Shared bathroom, with a bathtub, hot water and a smart toilet — warm seat and built-in bidet":
    "Baño compartido, con bañera, agua caliente e inodoro inteligente: asiento térmico y bidé integrado",
  "Your own room, with a lock on the door": "Tu propia habitación, con cerradura en la puerta",
  "Your own room and private balcony, with a lock on the door": "Tu propia habitación y balcón privado, con cerradura en la puerta",
  "Wifi": "Wifi",
  "Air conditioning": "Aire acondicionado",
  "Central air conditioning": "Aire acondicionado central",
  "Heating": "Calefacción",
  "Dedicated workspace": "Espacio de trabajo exclusivo",
  "65-inch QLED AI smart TV": "Smart TV QLED con IA de 65 pulgadas",
  "43-inch smart TV": "Smart TV de 43 pulgadas",
  "Mini fridge": "Minirrefrigerador",
  "Microwave": "Microondas",
  "Coffee maker": "Cafetera",
  "Backyard": "Patio trasero",
  "Portable fans": "Ventiladores portátiles",
  "Towels and bed linen": "Toallas y ropa de cama",
  "Free street parking": "Estacionamiento gratis en la calle",
  "Self check-in": "Llegada autónoma",
  "Free, safe street parking outside": "Estacionamiento gratis y seguro en la calle, frente a la casa",
  "Shared kitchen, open to every guest in the house": "Cocina compartida, abierta a todos los huéspedes de la casa",

  // Nav bar and Look menu
  // "Look" sits in a narrow header button; "Aspecto" is the shortest natural
  // word for it. The tier badges are chip-short too.
  "TT House Logo": "Logo de TT House",
  "Book with TT House": "Reserva con TT House",
  "Your bookings": "Tus reservas",
  "Cherished": "Muy querido",
  "Valued": "Apreciado",
  "Loyal": "Fiel",
  "Returning": "De regreso",
  "Home": "Inicio",
  "Change how TiBook looks": "Cambiar el aspecto de TiBook",
  "Look": "Aspecto",
  "Welcome back.": "Qué gusto verte de nuevo.",
  "We put the rooms first this time. Tap here for Classic, or any look you like.":
    "Esta vez te mostramos primero las habitaciones. Toca aquí para Classic o el aspecto que prefieras.",
  "Make it yours.": "Hazlo a tu gusto.",
  "Tap here for Classic, Neon or Hero, in the colour you like.": "Toca aquí para Classic, Neon o Hero, en el color que quieras.",
  "Dismiss": "Cerrar",
  "Show me": "Muéstrame",
  "Light and calm": "Claro y tranquilo",
  "Dark and bright": "Oscuro y brillante",
  "Neon, rooms first": "Neon, habitaciones primero",
  "Colour": "Color",
  "{name} colour": "Color {name}",
  "green": "verde",
  "amber": "ámbar",
  "teal": "verde azulado",
  "rose": "rosa",
  "indigo": "índigo",

  // Hero layout
  // "libre" rather than "disponible" in these availability lines: they sit on
  // one line under the photo and the shorter word keeps them from wrapping.
  "{room} is free {n} night": "{room} está libre {n} noche",
  "{room} is free {n} nights": "{room} está libre {n} noches",
  "{rooms} · {n} night open": "{rooms} · {n} noche libre",
  "{rooms} · {n} nights open": "{rooms} · {n} noches libres",
  "{n} night open": "{n} noche libre",
  "{n} nights open": "{n} noches libres",
  " or ": " o ",
  "About {name} and its hosts": "Sobre {name} y sus anfitriones",
  "About {name}": "Sobre {name}",
  "{n} rooms picked · swipe to see each": "{n} habitaciones elegidas · desliza para ver cada una",
  "Room {i} of {n} · swipe for more": "Habitación {i} de {n} · desliza para ver más",
  "Any room · swipe through all {n}": "Cualquier habitación · desliza para ver las {n}",
  "/ night · your rate": "/ noche · tu tarifa",
  "Your price is agreed with {name}": "Tu precio lo acuerdas con {name}",
  "{n} photos": "{n} fotos",
  "Details": "Detalles",
  "Any room is fine": "Cualquier habitación está bien",
  "{name} picks the room and agrees your price. Same house, same bathrooms.":
    "{name} elige la habitación y acuerda tu precio contigo. Misma casa, mismos baños.",
  "Your host": "Tu anfitrión",
  "Rooms to show in the month": "Habitaciones que se muestran en el mes",
  "Any room": "Cualquier habitación",
  // "held" = a reserved, unpaid stay the host is keeping for the guest.
  "{n} booking held for you — tap to review & pay": "{n} reserva apartada para ti: toca para revisar y pagar",
  "{n} bookings held for you — tap to review & pay": "{n} reservas apartadas para ti: toca para revisar y pagar",
  "Stays TT lined up for you": "Estadías que TT preparó para ti",
  "stay": "estadía",
  "stays": "estadías",
  "Request a Booking": "Solicitar una reserva",
  // Fallback for the guest's first name in a narrow chip, and the label on
  // the guest's own chat bubbles.
  "You": "Tú",

  // TiBook page
  "{n} date · ★ {w} wish list": "{n} fecha · ★ {w} en lista de deseos",
  "{n} dates · ★ {w} wish list": "{n} fechas · ★ {w} en lista de deseos",
  "{n} date selected": "{n} fecha seleccionada",
  "{n} dates selected": "{n} fechas seleccionadas",
  "★ {n} wish list date": "★ {n} fecha en lista de deseos",
  "★ {n} wish list dates": "★ {n} fechas en lista de deseos",
  "Loading…": "Cargando…",
  "Loading...": "Cargando…",
  "Show the rooms": "Ver las habitaciones",
  "Open the calendar": "Abrir el calendario",
  "No host selected": "No hay anfitrión seleccionado",
  "Review Request": "Revisar solicitud",
  "Book another room": "Reservar otra habitación",
  "Open Your Bookings with your phone number first, then try again.":
    "Primero abre Tus reservas con tu número de teléfono y luego vuelve a intentarlo.",
  "{date} removed from your wish list": "{date} se quitó de tu lista de deseos",
  "Undo": "Deshacer",
  "Add this holiday night?": "¿Agregar esta noche festiva?",
};
