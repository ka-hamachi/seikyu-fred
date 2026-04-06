import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Gemini APIでPDFを解析し、請求先・金額を抽出
 */
export async function parsePdfWithGemini(
  buffer: Uint8Array,
  type: "sales" | "payment" = "sales",
  mimeType: string = "application/pdf"
): Promise<{ client: string; amount: number }> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const base64 = Buffer.from(buffer).toString("base64");

    const clientInstruction =
      type === "sales"
        ? `"client"は請求「先」（宛先）の会社名または個人名です。請求「元」（発行者）ではありません。`
        : `"client"は請求「元」（発行者・差出人）の会社名または個人名です。請求「先」（宛先=株式会社FRED）ではありません。`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      {
        text: `この請求書から以下の情報をJSON形式で返してください。JSONのみ返してください。

{"client": "名前", "amount": 数値}

ルール:
- ${clientInstruction}
- clientは会社名または個人名（フルネーム）を返してください。「御中」「様」「殿」は除いてください。
- amountは税込合計の請求金額を数値で返してください（カンマなし）
- clientが見つからない場合は空文字にしてください
- 金額が見つからない場合はamountを0にしてください`,
      },
    ]);

    const text = result.response.text().trim();
    console.log("[gemini] Raw response:", text);
    // JSONブロックを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        client: String(parsed.client || "").replace(/御中|様|殿/g, "").trim(),
        amount: Number(parsed.amount) || 0,
      };
    }
  } catch (err) {
    console.error("[gemini] Parse error:", err);
  }

  return { client: "", amount: 0 };
}

/**
 * ファイル名から会社名を抽出（Geminiフォールバック用）
 */
export function extractClientFromFileName(fileName: string): string {
  const name = fileName.replace(/\.(pdf|png|jpe?g|webp)$/i, "").trim();

  const gotyuMatch = name.match(
    /^((?:株式会社|合同会社|有限会社)\s*[\S]+(?:\s+[\S]+)*?)\s*御中/
  );
  if (gotyuMatch) return gotyuMatch[1].trim();

  const gotyuMatch2 = name.match(
    /^([\S]+(?:\s+[\S]+)*?\s*(?:株式会社|合同会社|有限会社))\s*御中/
  );
  if (gotyuMatch2) return gotyuMatch2[1].trim();

  const engMatch = name.match(
    /^([\w][\w\s&.,()'-]+?(?:Co\.\s*,?\s*Ltd\.?|Inc\.?|LLC|Corp\.?|Co\.|Ltd\.?))\s*御中/i
  );
  if (engMatch) return engMatch[1].trim();

  const anyGotyuMatch = name.match(/^(.+?)\s*御中/);
  if (anyGotyuMatch && anyGotyuMatch[1].length <= 50) return anyGotyuMatch[1].trim();

  const samaMatch = name.match(/^(.+?)\s*様/);
  if (samaMatch && samaMatch[1].length <= 50) return samaMatch[1].trim();

  return "";
}
