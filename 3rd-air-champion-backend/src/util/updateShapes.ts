/**
 * The places an update's fields can actually be.
 *
 * A Mongoose pre-update hook is handed whatever the caller passed, and callers
 * pass two different shapes:
 *
 *     Host.findByIdAndUpdate(id, { password })        // top level
 *     Host.findByIdAndUpdate(id, { $set: { password } })
 *
 * Worse, `timestamps: true` adds its own `$set: { updatedAt }` to the FIRST
 * form. So an ordinary top-level update arrives as
 *
 *     { password, $set: { updatedAt }, $setOnInsert: {...} }
 *
 * — fields at the top level AND a `$set` that holds only a timestamp.
 *
 * Every hook that read one shape was therefore wrong for somebody:
 *
 *   - `update.$set ?? update` found the timestamp-only `$set`, saw no password
 *     in it, and did nothing. The new password went to the database in
 *     PLAINTEXT and name validation was skipped. (hostSchema, roomSchema)
 *   - Reading only the top level missed a caller who passed `{ $set: {...} }`.
 *     Same plaintext password, opposite call site. (cohostSchema)
 *
 * Three files each had their own half-right version, which is why the same bug
 * was found three times. There is one now: check every shape present.
 *
 * Returns objects to be MUTATED in place — hashing a password or lowercasing an
 * email here changes what Mongoose actually writes.
 */
export const updateShapes = (update: unknown): any[] => {
  if (!update || typeof update !== "object" || Array.isArray(update)) return [];
  return [update as any, (update as any).$set].filter(
    (o) => o && typeof o === "object" && !Array.isArray(o),
  );
};
