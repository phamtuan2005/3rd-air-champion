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
}
