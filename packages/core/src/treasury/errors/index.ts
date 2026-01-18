export type TreasuryError =
  | { type: 'REPOSITORY_ERROR'; cause: Error }
  | { type: 'INSUFFICIENT_BALANCE'; required: bigint; available: bigint }
  | { type: 'INVALID_AMOUNT'; message: string }
  | { type: 'USER_NOT_FOUND' };
