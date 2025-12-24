import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
];

export type { Command } from './types';
