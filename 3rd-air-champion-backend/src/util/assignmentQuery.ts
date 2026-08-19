import CleaningAssignment from "../model/cleaningAssignmentSchema";

// The one way cleaning assignments are read.
//
// TiMag's calendar and Clean panel have read them correctly for a long time;
// TiWork asked the same question with its own hand-written query and got a
// different answer — it omitted `host`, so it saw across every host document in
// the database and told Henry he had cleaned a room the calendar had given to
// Cindy.
//
// A second implementation of a question already answered reliably is a second
// chance to answer it differently. Both routes call this now, so they cannot.
export const findAssignments = (params: {
  host: unknown;
  start: string;
  end: string;
  cleaner?: unknown; // narrows to one person, for their own view
}) =>
  CleaningAssignment.find({
    host: params.host,
    ...(params.cleaner ? { cleaner: params.cleaner } : {}),
    date: { $gte: params.start, $lte: params.end },
  })
    .populate("room", "name color")
    .populate("cleaner")
    .sort({ date: 1 });
