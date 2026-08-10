export interface hostType {
  id: string;
  guests?: string[];
  email: string;
  rooms?: string[];
  airbnbsync?: { room: string; link: string }[];
  // Stamped by the scheduled sync on every run, successes and failures alike,
  // so the app can say when it last ran instead of nobody knowing.
  lastAutoSync?: {
    at?: string;
    added?: number;
    removed?: number;
    addedKeys?: string[];
    error?: string;
  };
  name: string;
  cohosts?: string[];
  calendar: string;
  phone?: string; // host contact number — guests text this to ask about a stay
  doorCode?: string;
  airbnbName?: string;
  airbnbAddress?: string;
  airbnbRating?: number;
  airbnbReviewCount?: number;
  airbnbReviewsUrl?: string;
  airbnbProfileUrl?: string;
  cohostProfileUrls?: string[];
  airbnbSuperhost?: boolean;
  highlights?: string[];
  houseRules?: string;
  cleaningRules?: string;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
}
