export interface roomType {
  id: string;
  name: string;
  price: number;
  roomCode: string;
  color?: string;
  active: boolean;
  photos?: string[];
  airbnbUrl?: string;
}
