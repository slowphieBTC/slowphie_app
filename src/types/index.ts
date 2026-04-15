// ── Farm info for one farm pool a token is deposited in ────────────
export interface FarmInfo {
  farmName:      string;   // e.g. "PILL Farm", "Satoshi's Farm"
  farmContract:  string;   // farm contract address
  farmLink:      string;   // external link for this farm
  poolId:        number;
  staked:        number;
  pending:       number;
  rewardToken:   string;   // what reward you earn
}

// ── Staking multi-reward info ───────────────────────────────────────
export interface StakingReward {
  tokenAddress: string;
  symbol:       string;
  pending:      number;  // formatted amount
}

export interface LPUnderlying {
  token0Symbol:  string;
  token1Symbol:  string;
  token0Amount:  number;
  token1Amount:  number;
  token0Address?: string;  // contract address of token0
  token1Address?: string;  // contract address of token1
}

export interface Position {
  id: string;
  address: string;
  type: 'stake' | 'farm' | 'lp';
  label: string;
  token: string;
  amount: number;            // primary display amount (wallet bal or staked)
  rewards: number;           // primary rewards
  rewardToken: string | null;
  contractAddress: string;   // token contract address
  poolId?: number;
  // Multi-view: wallet balance + multiple farm positions
  walletBalance?: number;
  farms?: FarmInfo[];        // all farm positions for this token
  hasFarmView?: boolean;     // show wallet/farm toggle
  // Legacy single-farm fields (still used for simple cards)
  farmStaked?: number;
  farmPending?: number;
  farmPoolId?: number;
  stakingRewards?: StakingReward[];  // multi-token staking rewards
  lpUnderlying?: LPUnderlying;       // underlying token amounts for LP wallet balance
  lpUnderlyingStaked?: LPUnderlying; // underlying token amounts for LP staked amount
  mchadStaking?: MchadStakingData;   // MCHAD custom staking card
  mchadLpStaking?: MchadStakingPos;  // MCHAD LP_STAKING tab on MCHAD/MOTO LP card
}

// ── MCHAD Custom Staking Protocol ──────────────────────────────────
export interface MchadStakingPos {
  contract:                  string;  // 'MCHAD_STAKING' | 'LP_STAKING'
  contractAddress:           string;
  stakedSymbol:              string;
  stakedFormatted:           string;
  stakedWeightedFormatted:   string;
  unclaimedRewardsFormatted: string;
  rewardSymbol:              string;
  multiplierFormatted:       string;
  lockDuration:              number;  // seconds
  unlockTimestamp:           number;  // unix
}

export interface MchadStakingData {
  positions:  MchadStakingPos[];
  mchadBal:   string;  // MCHAD wallet balance formatted
  mchadMotoBal: string; // MCHAD/MOTO LP balance formatted
  mchadPillBal: string; // MCHAD/PILL LP balance formatted
}

export type StakePosition = Position & { type: 'stake' };
export type FarmPosition  = Position & { type: 'farm' };
export type LPPosition    = Position & { type: 'lp' };

export interface Address {
  id: string;
  label: string;
  address: string;
  addedAt: number;
}

export interface AddressPositions {
  positions: Position[];
  loading: boolean;
  error: string | null;
  lastUpdated?: number;
}

export interface TrackedAddress {
  id: string;
  label: string;
  address: string;
}

export interface BlockEvent {
  type: 'block';
  height: number;
  timestamp: number;
}

export interface PriceEvent {
  type: 'price';
  symbol: string;
  price: number;
  timestamp: number;
}

export type StreamEvent = BlockEvent | PriceEvent;

export interface PricePoint {
  time: number;
  value: number;
}

// ─── OpSchool types ────────────────────────────────────────────────────────
export interface Module {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  difficulty: string;
  difficultyColor: string;
  estimatedTime: string;
  icon: string;
  description: string;
  keyTopics: string[];
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface UserProgress {
  completedModules: number[];
  quizScores: Record<number, number>;
  lastAccessedModule: number | null;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  letter: string;
  relatedTerms?: string[];
}
