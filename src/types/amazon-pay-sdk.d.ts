// @amazonpay/amazon-pay-api-sdk-nodejs には型定義がないため、使う部分だけ宣言する
declare module "@amazonpay/amazon-pay-api-sdk-nodejs" {
  interface AmazonPayConfig {
    publicKeyId: string;
    privateKey: string | Buffer;
    region: "us" | "eu" | "jp";
    sandbox?: boolean;
    algorithm?: "AMZN-PAY-RSASSA-PSS" | "AMZN-PAY-RSASSA-PSS-V2";
  }

  // axios のレスポンスがそのまま返る
  interface AmazonPayResponse {
    status: number;
    data: unknown;
  }

  export class WebStoreClient {
    constructor(config: AmazonPayConfig);
    getReports(queryParameters?: Record<string, string | number> | null, headers?: Record<string, string> | null): Promise<AmazonPayResponse>;
    getReportDocument(reportDocumentId: string, headers?: Record<string, string> | null): Promise<AmazonPayResponse>;
  }
}
