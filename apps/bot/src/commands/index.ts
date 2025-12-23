import { walletCommand } from './wallet';
import { leaderboardCommand } from './leaderboard';
import type { Command } from './types';

export const commands: Command[] = [
  walletCommand,
  leaderboardCommand,
];

export type { Command } from './types';
