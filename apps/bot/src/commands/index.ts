import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { grantCommand } from './grant';
import { deductCommand } from './deduct';
import { inventoryCommand } from './inventory';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  grantCommand,
  deductCommand,
  inventoryCommand,
];

export type { Command } from './types';
