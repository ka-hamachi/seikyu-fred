import type { DepositProvider } from "@/types";
import type { DepositProviderAdapter } from "./types";
import { fincodeAdapter } from "./fincode";
import { amazonPayAdapter } from "./amazon-pay";
import { stripeAdapter } from "./stripe";

// BluePay は一覧を取得するAPIがないため、ここではなく Webhook（/api/hightore/bluepay/webhook）で取り込む
export const DEPOSIT_ADAPTERS: Partial<Record<DepositProvider, DepositProviderAdapter>> = {
  fincode: fincodeAdapter,
  amazon_pay: amazonPayAdapter,
  stripe: stripeAdapter,
};
