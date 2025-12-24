import type { XpService, CurrencyService, ShopService } from '@topia/core';

export interface Container {
  xpService: XpService;
  currencyService: CurrencyService;
  shopService: ShopService;
}
