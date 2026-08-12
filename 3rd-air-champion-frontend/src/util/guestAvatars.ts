// A set of ready-made looks for a guest avatar.
//
// Only this short note is stored; the picture is generated from it plus the
// guest's name (see avatarGen), so two guests who pick the same look still get
// different faces. Nothing is uploaded and no image is kept anywhere.
//
// The strings are not decoration — avatarGen reads specific keywords out of
// them (glasses, beard, bald, ponytail, hair colours, skin tones, "old"), so
// editing a label is free but editing a `character` changes the picture.
export interface GuestAvatarPreset {
  id: string;
  label: string;
  character: string;
}

export const GUEST_AVATAR_PRESETS: GuestAvatarPreset[] = [
  // The first entry is the way back out. Without it a guest could be given an
  // avatar and never returned to plain initials.
  { id: "none", label: "Initials", character: "" },

  { id: "a1", label: "Dark hair", character: "short black hair" },
  { id: "a2", label: "Glasses", character: "brown hair, glasses" },
  { id: "a3", label: "Long blonde", character: "long blonde hair" },
  { id: "a4", label: "Ponytail", character: "ponytail, brown hair" },
  { id: "a5", label: "Beard", character: "black hair, beard" },
  { id: "a6", label: "Bald", character: "bald, mustache" },
  { id: "a7", label: "Silver", character: "old, gray hair, glasses" },
  { id: "a8", label: "Long dark", character: "long black hair" },
  { id: "a9", label: "Ginger", character: "red hair, beard" },
  { id: "a10", label: "Tan", character: "tan skin, black hair" },
  { id: "a11", label: "Deep", character: "dark skin, short hair" },
  { id: "a12", label: "Fair", character: "pale skin, blonde hair, glasses" },
  { id: "a13", label: "Studious", character: "black hair, glasses, beard" },
  { id: "a14", label: "Elder", character: "old, white hair" },
  { id: "a15", label: "Auburn", character: "long red hair" },
  { id: "a16", label: "Clean cut", character: "bald, glasses" },
  { id: "a17", label: "Chestnut", character: "brown hair, mustache" },
  { id: "a18", label: "Ash", character: "gray hair, ponytail" },
];
