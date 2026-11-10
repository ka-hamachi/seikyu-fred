import { formatCurrency } from "@/lib/utils";

export interface MonthlyBarData {
  month: number;
  label: string;
  value: number;
}

// profit: プラスは緑・マイナスは赤（粗利向け） / cost: オレンジ（支払い向け）
type Tone = "profit" | "cost";

function formatBarLabel(value: number): string {
  if (value >= 1000000 || value <= -1000000) return `${(value / 10000).toFixed(0)}万`;
  if (value >= 1000 || value <= -1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
}

export default function MonthlyBarChart({ title, data, tone }: { title: string; data: MonthlyBarData[]; tone: Tone }) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  const chartH = 200;
  const barW = 40;
  const gap = 16;
  const totalW = data.length * (barW + gap) - gap;
  // 粗利はマイナスもあるので中央、支払いはプラスのみなので下端を0の線にする
  const zeroY = tone === "profit" ? chartH / 2 : chartH;

  // 年間合計
  const yearTotal = data.reduce((sum, d) => sum + d.value, 0);

  const iconClass = tone === "profit" ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600";
  const totalClass =
    tone === "profit" ? (yearTotal >= 0 ? "text-emerald-600" : "text-red-500") : "text-gray-800";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-500">年間合計</p>
          <p className={`text-2xl font-bold ${totalClass}`}>
            {formatCurrency(yearTotal)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalW + 20} ${chartH + 40}`}
          className="w-full"
          style={{ minWidth: `${totalW + 20}px`, maxHeight: "260px" }}
        >
          {/* zero line */}
          <line x1="0" y1={zeroY} x2={totalW + 20} y2={zeroY} stroke="#e5e7eb" strokeWidth="1" />

          {data.map((d, i) => {
            const x = i * (barW + gap) + 10;
            const ratio = d.value / maxAbs;
            const barH = Math.abs(ratio) * (zeroY - 20);
            const isPositive = d.value >= 0;
            const y = isPositive ? zeroY - barH : zeroY;
            const fill = tone === "cost" ? "#f97316" : isPositive ? "#10b981" : "#ef4444";
            const hasData = d.value !== 0;

            return (
              <g key={d.month}>
                {hasData && (
                  <>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(barH, 1)}
                      rx="4"
                      fill={fill}
                      opacity={0.8}
                    />
                    <text
                      x={x + barW / 2}
                      y={isPositive ? y - 4 : y + barH + 12}
                      textAnchor="middle"
                      className="text-[9px] fill-gray-500"
                    >
                      {formatBarLabel(d.value)}
                    </text>
                  </>
                )}
                {/* month label */}
                <text
                  x={x + barW / 2}
                  y={chartH + 16}
                  textAnchor="middle"
                  className="text-[11px] fill-gray-400"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
