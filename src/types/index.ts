export interface BuyIn {
  id: string;
  amount: number;
  timestamp: Date;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  active: boolean;
  buyIns: BuyIn[];
  totalBuyIn: number;
  cashOuts: number[];
}

export interface PokerTable {
  id: string;
  name: string;
  players: Player[];
  smallBlind: number;
  bigBlind: number;
  createdAt: Date;
  isActive: boolean;
  creatorId: string;
  location: string;
} 