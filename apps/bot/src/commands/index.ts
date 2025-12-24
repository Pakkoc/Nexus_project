import { myInfoCommand } from './my-info';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
];

export type { Command } from './types';
