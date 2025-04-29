export interface Player {
  id: string;
  name: string;
  nickname?: string;
  chips: number;
  active: boolean;
  buyIns: BuyIn[];
  totalBuyIn: number;
  cashOuts: CashOut[];
  showMe: boolean;
  tableId: string;
}

export interface BuyIn {
  id: string;
  playerId: string;
  amount: number;
  timestamp: Date;
}

export interface CashOut {
  id: string;
  playerId: string;
  amount: number;
  timestamp: Date;
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
  location?: string;
} 