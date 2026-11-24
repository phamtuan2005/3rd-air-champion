import BookingRequest from "../model/bookingRequestSchema";
import { dropUsCountryCode } from "./usPhone";

export interface NewBookingRequest {
  host: string;
  guestName: string;
  guestPhone: string;
  /** The first night, yyyy-MM-dd. */
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
  notes?: string;
}

// The one way a booking request is written, whoever sends it: TiBook's form
// and TT (through the createBookingRequest mutation) and the connector AI
// assistants book through (route/assistantRoute). The host's Requests screen
// must see the same thing from all of them.
//
// `source` says which door it came through. It is set by the server, never
// taken from the caller: the GraphQL mutation has no argument for it, so a
// TiBook request cannot claim to be anything else.
export const createBookingRequest = async (r: NewBookingRequest, source = "") => {
  // Stored without a +1, as every guest phone is (util/usPhone).
  const guestPhone = dropUsCountryCode(r.guestPhone);
  // The same stay asked for again, still pending, returns the request already
  // there rather than a second copy — as the mutation always has.
  const existing = await BookingRequest.findOne({
    host: r.host,
    guestPhone,
    date: new Date(r.date),
    room: r.room,
    duration: r.duration,
    numberOfGuests: r.numberOfGuests,
    status: "pending",
  });
  if (existing) return existing;

  return await new BookingRequest({
    host: r.host,
    guestName: r.guestName,
    guestPhone,
    date: r.date,
    room: r.room,
    duration: r.duration,
    numberOfGuests: r.numberOfGuests,
    status: "pending",
    notes: r.notes ?? "",
    source,
  }).save();
};
