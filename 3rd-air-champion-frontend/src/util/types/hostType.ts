export interface hostType {
  id: string;
  guests?: string[];
  email: string;
  rooms?: string[];
  airbnbsync?: { room: string; link: string }[];
  name: string;
  cohosts?: string[];
  calendar: string;
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
}
