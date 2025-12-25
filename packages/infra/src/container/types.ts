import type { XpService, CurrencyService, ShopService, MarketService, MarketSettingsService, BankService } from '@topia/core';

export interface Container {
  xpService: XpService;
  currencyService: CurrencyService;
  shopService: ShopService;
  marketService: MarketService;
  marketSettingsService: MarketSettingsService;
  bankService: BankService;
}
