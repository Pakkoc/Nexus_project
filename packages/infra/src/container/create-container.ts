import { XpService, CurrencyService, ShopService, MarketService, MarketSettingsService } from '@topia/core';
import { getPool } from '../database/pool';
import {
  XpRepository,
  XpSettingsRepository,
  TopyWalletRepository,
  RubyWalletRepository,
  CurrencySettingsRepository,
  CurrencyTransactionRepository,
  DailyRewardRepository,
  ShopRepository,
  MarketRepository,
  MarketSettingsRepository,
} from '../database/repositories';
import { SystemClock } from '../clock';
import type { Container } from './types';

export function createContainer(): Container {
  const pool = getPool();

  // Infrastructure
  const clock = new SystemClock();

  // XP Repositories
  const xpRepo = new XpRepository(pool);
  const xpSettingsRepo = new XpSettingsRepository(pool);

  // Currency Repositories
  const topyWalletRepo = new TopyWalletRepository(pool);
  const rubyWalletRepo = new RubyWalletRepository(pool);
  const currencySettingsRepo = new CurrencySettingsRepository(pool);
  const currencyTransactionRepo = new CurrencyTransactionRepository(pool);
  const dailyRewardRepo = new DailyRewardRepository(pool);
  const shopRepo = new ShopRepository(pool);
  const marketRepo = new MarketRepository(pool);
  const marketSettingsRepo = new MarketSettingsRepository(pool);

  // Services
  const xpService = new XpService(xpRepo, xpSettingsRepo, clock);
  const currencyService = new CurrencyService(
    topyWalletRepo,
    rubyWalletRepo,
    currencySettingsRepo,
    currencyTransactionRepo,
    clock,
    dailyRewardRepo
  );
  const shopService = new ShopService(
    shopRepo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    clock
  );
  const marketService = new MarketService(
    marketRepo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    clock
  );
  const marketSettingsService = new MarketSettingsService(marketSettingsRepo);

  return {
    xpService,
    currencyService,
    shopService,
    marketService,
    marketSettingsService,
  };
}
