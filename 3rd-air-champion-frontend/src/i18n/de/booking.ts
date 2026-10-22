// German for TiBook's booking screens — see index.ts.
//
// Some lines are pieces of a sentence the screen assembles (" — tap to add
// them" after a count). They are translated as the piece they are, so the
// German still reads when the pieces are put together.
export const booking: Record<string, string> = {
  // ── Booking request: header and steps ──
  "Your Dates": "Deine Reisedaten",
  "Your Booking": "Deine Buchung",
  "About You": "Über dich",
  "Pick your dates — just one more step after this": "Wähl deine Reisedaten – danach fehlt nur noch ein Schritt",
  "Check it over and send — we have the rest": "Kurz prüfen und absenden – alles andere haben wir schon",
  "Last step — fill in your info and you're done": "Letzter Schritt – trag deine Angaben ein, dann bist du fertig",
  "Step {step} of 2": "Schritt {step} von 2",
  "All done!": "Geschafft!",
  Close: "Schließen",

  // ── Success screen ──
  "Request sent!": "Anfrage gesendet!",
  "We'll be in touch shortly to confirm your stay. Can't wait to host you!":
    "Wir melden uns gleich, um deinen Aufenthalt zu bestätigen. Wir freuen uns schon auf dich!",
  "We'll let you know as soon as those dates open up!": "Wir sagen dir Bescheid, sobald diese Tage frei werden!",
  "We'll also notify you if your wish list dates become available.":
    "Wir sagen dir auch Bescheid, wenn Tage auf deiner Wunschliste frei werden.",
  "While you wait — our house rules": "Während du wartest – unsere Hausregeln",

  // ── Step 1: dates ──
  "Your dates include a US holiday": "In deinem Zeitraum liegt ein US-Feiertag",
  "Your dates include {n} US holidays": "In deinem Zeitraum liegen {n} US-Feiertage",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay that night?":
    "Bei mehreren Nächten am Stück rutscht ein Feiertag leicht mit hinein. Möchtest du in dieser Nacht wirklich bleiben?",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay those nights?":
    "Bei mehreren Nächten am Stück rutscht ein Feiertag leicht mit hinein. Möchtest du in diesen Nächten wirklich bleiben?",
  "Choose one to continue.": "Wähl eine Option, um fortzufahren.",
  "Take it out": "Herausnehmen",
  "Take them out": "Herausnehmen",
  "Keep — I'll be staying": "Behalten – ich bleibe",
  "Holiday night kept:": "Feiertagsnacht behalten:",
  "Holiday nights kept:": "Feiertagsnächte behalten:",
  "Dates picked from calendar": "Im Kalender gewählte Tage",
  "{n} night": "{n} Nacht",
  "{n} nights": "{n} Nächte",
  "{date} · 1 night": "{date} · 1 Nacht",
  "{start} – {end} · {n} nights": "{start} – {end} · {n} Nächte",
  "Remove {what}?": "{what} entfernen?",
  "Yes, remove": "Ja, entfernen",
  Keep: "Behalten",
  Remove: "Entfernen",
  "Calendar — tap to pick more dates": "Kalender – tippen, um weitere Tage zu wählen",
  "Tap here to browse the calendar": "Tippe hier, um im Kalender zu stöbern",
  "Pick your dates and come back to complete your request": "Wähl deine Reisedaten und komm zurück, um deine Anfrage abzuschließen",
  "Sold-out dates (wish list)": "Ausgebuchte Tage (Wunschliste)",
  "We'll notify you if these open up.": "Wir sagen dir Bescheid, wenn diese frei werden.",
  "and / or": "und / oder",
  "Write your dates": "Schreib deine Reisedaten",
  // The example keeps English month names: the date reader understands those.
  "e.g. May 1, 3–5, 20–21 — or anything else you'd like us to know":
    "z. B. May 1, 3–5, 20–21 – oder alles, was wir sonst noch wissen sollten",
  "e.g. May 1, 3–5, 20–21\nor anything else you'd like us to know":
    "z. B. May 1, 3–5, 20–21\noder alles, was wir sonst noch wissen sollten",
  "Please pick dates on the calendar or write your dates below.":
    "Wähl bitte Tage im Kalender oder schreib deine Reisedaten unten hinein.",
  "1 date read from what you wrote": "1 Tag aus deinem Text erkannt",
  "{n} dates read from what you wrote": "{n} Tage aus deinem Text erkannt",
  " — tap to add them": " – tippe, um sie hinzuzufügen",
  "{day} has already gone by": "{day} ist schon vorbei",
  "{n} of those nights have already gone by": "{n} dieser Nächte sind schon vorbei",
  " — we've kept the rest.": " – den Rest haben wir übernommen.",
  "Next — Finalize your booking →": "Weiter – Buchung abschließen →",
  "Next — Tell us about you →": "Weiter – Erzähl uns von dir →",

  // ── The write-your-dates sheet ──
  "We read this date": "Diesen Tag haben wir erkannt",
  "We read these {n} dates": "Diese {n} Tage haben wir erkannt",
  "This night has already gone by": "Diese Nacht ist schon vorbei",
  "{n} of these nights have already gone by": "{n} dieser Nächte sind schon vorbei",
  "We've left those out and kept the rest.": "Die haben wir weggelassen, den Rest übernommen.",
  "Nothing to add from this yet.": "Daraus gibt es noch nichts hinzuzufügen.",
  "If you meant next year, add the year — \"{example}\" — and we'll pick it up.":
    "Falls du nächstes Jahr meinst, schreib das Jahr dazu – „{example}“ – dann erkennen wir es.",
  "No need to book — that night is already yours.": "Keine Buchung nötig – diese Nacht gehört schon dir.",
  "No need to book — those nights are already yours.": "Keine Buchung nötig – diese Nächte gehören schon dir.",
  "{n} of these night is already booked in your name — nothing to do for it.":
    "{n} dieser Nächte ist schon auf deinen Namen gebucht – dafür musst du nichts tun.",
  "{n} of these nights are already booked in your name — nothing to do for them.":
    "{n} dieser Nächte sind schon auf deinen Namen gebucht – dafür musst du nichts tun.",
  "The crossed-out date is full tonight — we'll watch it for you and tell you the moment it opens up.":
    "Der durchgestrichene Tag ist im Moment ausgebucht – wir behalten ihn für dich im Blick und sagen dir sofort Bescheid, wenn er frei wird.",
  "The crossed-out dates are full tonight — we'll watch them for you and tell you the moment they open up.":
    "Die durchgestrichenen Tage sind im Moment ausgebucht – wir behalten sie für dich im Blick und sagen dir sofort Bescheid, wenn sie frei werden.",
  "All of these are already in your request.": "Die sind alle schon in deiner Anfrage.",
  "We'll pass this on too: \"{text}\"": "Das geben wir auch weiter: „{text}“",
  "Request {n} date, watch {m} more": "{n} Tag anfragen, {m} weitere beobachten",
  "Request {n} dates, watch {m} more": "{n} Tage anfragen, {m} weitere beobachten",
  "Add {n} date to my request": "{n} Tag zu meiner Anfrage hinzufügen",
  "Add {n} dates to my request": "{n} Tage zu meiner Anfrage hinzufügen",
  "Watch {n} full date for me": "{n} ausgebuchten Tag für mich beobachten",
  "Watch {n} full dates for me": "{n} ausgebuchte Tage für mich beobachten",
  Done: "Fertig",

  // ── Step 2: about you / your booking ──
  "Your phone number": "Deine Telefonnummer",
  "So we can reach you": "Damit wir dich erreichen können",
  "Please enter your phone number": "Gib bitte deine Telefonnummer ein",
  "looking up...": "wird gesucht …",
  "We'll sort out pricing together after your request.": "Den Preis klären wir nach deiner Anfrage gemeinsam.",
  "Your name": "Dein Name",
  "e.g. John Smith": "z. B. Max Mustermann",
  "Please enter your name": "Gib bitte deinen Namen ein",
  "Room summary": "Zimmerübersicht",
  "{n}n": "{n} N.",
  "~${amount} estimated": "ca. ${amount} (geschätzt)",
  "{n} separate stays — pick a room for each.": "{n} getrennte Aufenthalte – wähl für jeden ein Zimmer.",
  "No room free for these nights": "Für diese Nächte ist kein Zimmer frei",
  "Select a room": "Zimmer wählen",
  "${rate}/night": "${rate}/Nacht",
  "~${total} ({n}n × ${rate}/night)": "ca. ${total} ({n} N. × ${rate}/Nacht)",
  "({n}n × ${rate}/night)": "({n} N. × ${rate}/Nacht)",
  "Total estimate": "Geschätzter Gesamtbetrag",
  "Which room?": "Welches Zimmer?",
  "Checking availability...": "Verfügbarkeit wird geprüft …",
  "No rooms available — try different dates.": "Keine Zimmer frei – probier es mit anderen Reisedaten.",
  "Please choose a room": "Wähl bitte ein Zimmer",
  "Please pick a room for {stay}.": "Wähl bitte ein Zimmer für {stay}.",
  "Wish list dates": "Tage auf der Wunschliste",
  "How many people?": "Wie viele Personen?",
  "{n} person": "{n} Person",
  "{n} people": "{n} Personen",
  "Something went wrong — please try again.": "Da ist etwas schiefgelaufen – versuch es bitte noch einmal.",
  "Hide ▴": "Ausblenden ▴",
  "Details ▾": "Details ▾",
  "Sending...": "Wird gesendet …",
  "Send My Request": "Anfrage senden",

  // ── Cancellation policy ──
  "Free cancellation up to {days} days before check-in": "Kostenlose Stornierung bis {days} Tage vor dem Check-in",
  "We fully understand your plans can change, and TT House will be flexible with that.":
    "Wir verstehen gut, dass sich Pläne ändern können – TT House kommt dir dabei entgegen.",
  "Full refund if you cancel {full}+ days before check-in": "Volle Rückerstattung bei Stornierung mindestens {full} Tage vor dem Check-in",
  "50% refund if {half}–{last} days before": "50 % Rückerstattung bei Stornierung {half}–{last} Tage vorher",
  "No refund within {half} days.": "Innerhalb von {half} Tagen vor dem Check-in keine Rückerstattung.",
  "Feel free to reach out to us anytime!": "Melde dich jederzeit gern bei uns!",

  // ── US holidays (names as German speakers know them, where they have one) ──
  "{name} (observed)": "{name} (Ersatzfeiertag)",
  "{holiday} — a US holiday": "{holiday} – ein US-Feiertag",
  "Make sure you mean to stay this night before you add it.":
    "Prüf kurz, ob du in dieser Nacht wirklich bleiben möchtest, bevor du sie hinzufügst.",
  "New Year's Day": "Neujahr",
  "Martin Luther King Jr. Day": "Martin-Luther-King-Tag",
  "Presidents' Day": "Presidents' Day",
  "Memorial Day": "Memorial Day",
  Juneteenth: "Juneteenth",
  "Independence Day": "Unabhängigkeitstag (USA)",
  "Labor Day": "Labor Day (Tag der Arbeit, USA)",
  "Columbus Day": "Columbus Day",
  "Veterans Day": "Veteranentag",
  Thanksgiving: "Thanksgiving",
  "Christmas Day": "Weihnachten",

  // ── Room picker ──
  "Only 1 room left": "Nur noch 1 Zimmer frei",
  "Pick your room": "Wähl dein Zimmer",
  "No other room is free for these dates.": "In diesem Zeitraum ist kein anderes Zimmer frei.",
  "Select ›": "Wählen ›",
  "Any available room": "Beliebiges freies Zimmer",

  // ── Held (reserved) bookings ──
  "the host": "dem Gastgeber",
  "No charge": "Kostenlos",
  "A booking is held for you": "Eine Buchung ist für dich reserviert",
  "{n} bookings held for you": "{n} Buchungen sind für dich reserviert",
  "Pending payment": "Zahlung ausstehend",
  "We're holding this booking just for you. To keep it, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "Wir halten diese Buchung extra für dich frei. Damit es so bleibt, schick bitte bald deine Zahlung – unbezahlte Reservierungen können sonst für andere Gäste freigegeben werden. 🙏",
  "We're holding these bookings just for you. To keep them, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "Wir halten diese Buchungen extra für dich frei. Damit es so bleibt, schick bitte bald deine Zahlung – unbezahlte Reservierungen können sonst für andere Gäste freigegeben werden. 🙏",
  "You'd planned to send payment by {date} — no problem if you need a little longer, just let {host} know.":
    "Du wolltest bis {date} bezahlen – kein Problem, wenn du etwas länger brauchst, sag einfach {host} Bescheid.",
  "You said you'd send payment by {date} — thank you!": "Du hast gesagt, du bezahlst bis {date} – danke dir!",
  "{amount} fees": "{amount} Gebühren",
  "{amount} loyalty discount applied": "{amount} Treuerabatt abgezogen",
  Total: "Gesamtbetrag",
  "Total to pay": "Zu zahlen",
  "Message {host} to pay": "{host} zum Bezahlen schreiben",
  "Got it": "Alles klar",
  "Asked for one of these by mistake? Just let {host} know and it will be released.":
    "Eine davon aus Versehen angefragt? Sag einfach {host} Bescheid, dann wird sie freigegeben.",

  // ── Your stay ──
  "Staying now": "Du bist gerade hier",
  "Check-in today": "Check-in heute",
  "in {n} day": "in {n} Tag",
  "in {n} days": "in {n} Tagen",
  Completed: "Abgeschlossen",
  "{n} guest": "{n} Gast",
  "{n} guests": "{n} Gäste",
  Door: "Haustür",
  Room: "Zimmer",
  "View full details": "Alle Details ansehen",
  "This stay is complete — thank you for staying with us. 🏠": "Dieser Aufenthalt ist vorbei – danke, dass du bei uns warst. 🏠",
  "Book another room for these dates": "Weiteres Zimmer für diesen Zeitraum buchen",
  "Text {host} about this stay": "{host} zu diesem Aufenthalt schreiben",
};
