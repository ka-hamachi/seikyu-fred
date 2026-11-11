import type { DepositProvider } from "@/types";
import type { DepositProviderAdapter } from "./types";
import { fincodeAdapter } from "./fincode";
import { amazonPayAdapter } from "./amazon-pay";
import { stripeAdapter } from "./stripe";

// BluePay は振込情報を取得するAPIがないため、ここではなく振込申請CSV（/api/hightore/deposits/bluepay-csv）で取り込む
export const DEPOSIT_ADAPTERS: Partial<Record<DepositProvider, DepositProviderAdapter>> = {
  fincode: fincodeAdapter,
  amazon_pay: amazonPayAdapter,
  stripe: stripeAdapter,
};
