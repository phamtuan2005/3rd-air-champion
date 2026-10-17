// A dev server that greets every load as a brand-new guest.
//
// What a first visit looks like — Hero opening the host banner by itself, the
// nudges that follow it, the Look nudge's invitation — happens once per device
// and is then remembered (util/tibookReturning). Checking it again meant a
// fresh private tab every time, or clearing site data by hand. Started with
//
//   VITE_ALWAYS_NEW_GUEST=true npx vite --host --port 5174 --strictPort
//
// a dev server forgets everything this origin stored, on every load, before
// the app reads any of it. The usual server on 5173 is untouched: storage is
// per origin, and a different port is a different origin.
//
// Dev only, and only when asked: import.meta.env.DEV is false in every build,
// so production never runs this, however the variable is set.
//
// Imported FIRST in main.tsx, for the order: tibookReturning freezes its
// answer when its module loads, and the theme reads the saved look as the app
// starts. Cleared any later, both would already have read the old values.
if (import.meta.env.DEV && import.meta.env.VITE_ALWAYS_NEW_GUEST === "true") {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Storage refused (private mode) is already a new guest.
  }
}

export {};
