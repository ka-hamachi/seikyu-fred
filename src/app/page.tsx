"use client";

import { useEffect, useState, useCallback } from "react";
import type { DashboardSummary } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface MonthlyData {
  month: number;
  label: string;
  sales: number;
  payments: number;
  credit: number;
  grossProfit: number;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  // Past 12 months + current month + next 1 month
  for (let i = -12; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options.reverse();
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function GrossProfitChart({ data, year }: { data: MonthlyData[]; year: number }) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.grossProfit)), 1);

  const chartH = 200;
  const barW = 40;
  const gap = 16;
  const totalW = data.length * (barW + gap) - gap;
  const midY = chartH / 2;

  // 年間合計
  const yearTotal = data.reduce((sum, d) => sum + d.grossProfit, 0);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">{year}年 粗利推移</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-500">年間合計</p>
          <p className={`text-2xl font-bold ${yearTotal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
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
          <line x1="0" y1={midY} x2={totalW + 20} y2={midY} stroke="#e5e7eb" strokeWidth="1" />

          {data.map((d, i) => {
            const x = i * (barW + gap) + 10;
            const ratio = d.grossProfit / maxAbs;
            const barH = Math.abs(ratio) * (midY - 20);
            const isPositive = d.grossProfit >= 0;
            const y = isPositive ? midY - barH : midY;
            const fill = isPositive ? "#10b981" : "#ef4444";
            const hasData = d.grossProfit !== 0;

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
                      {d.grossProfit >= 1000000 || d.grossProfit <= -1000000
                        ? `${(d.grossProfit / 10000).toFixed(0)}万`
                        : d.grossProfit >= 1000 || d.grossProfit <= -1000
                          ? `${(d.grossProfit / 1000).toFixed(0)}k`
                          : d.grossProfit.toString()}
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

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [yearlyData, setYearlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const monthOptions = generateMonthOptions();
  const currentYear = new Date().getFullYear();

  const fetchSummary = useCallback((month: string) => {
    setLoading(true);
    fetch(`/api/dashboard?month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        setSummary(data);
        setLoading(false);
      });
  }, []);

  const fetchYearly = useCallback(() => {
    fetch(`/api/dashboard/yearly?year=${currentYear}`)
      .then((res) => res.json())
      .then((data) => setYearlyData(data.months || []));
  }, [currentYear]);

  useEffect(() => {
    fetchSummary(selectedMonth);
  }, [selectedMonth, fetchSummary]);

  useEffect(() => {
    fetchYearly();
  }, [fetchYearly]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
  };

  const selectedLabel = monthOptions.find((o) => o.value === selectedMonth)?.label || "";

  const cards = summary
    ? [
        {
          title: "売上請求書",
          amount: summary.totalSales,
          sub: `未入金: ${summary.unpaidSalesCount}件`,
          color: "blue",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
        },
        {
          title: "支払い請求書",
          amount: summary.totalPayments,
          sub: `未支払い: ${summary.unpaidPaymentsCount}件`,
          color: "orange",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          ),
        },
        {
          title: "クレジット支払い",
          amount: summary.totalCredit,
          sub: `${summary.creditCount}件（出金-入金）`,
          color: "purple",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
        },
      ]
    : [];

  const colorMap: Record<string, { iconBg: string; text: string }> = {
    blue: { iconBg: "bg-blue-100", text: "text-blue-600" },
    orange: { iconBg: "bg-orange-100", text: "text-orange-600" },
    purple: { iconBg: "bg-purple-100", text: "text-purple-600" },
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <select
          value={selectedMonth}
          onChange={handleMonthChange}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all cursor-pointer"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 年間粗利推移グラフ */}
      {yearlyData.length > 0 && (
        <GrossProfitChart data={yearlyData} year={currentYear} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      ) : summary ? (
        <>
          {/* Gross Profit Card */}
          <div className="bg-white rounded-2xl p-5 md:p-8 mb-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-2">{selectedLabel}の粗利</p>
                <p className={`text-2xl md:text-4xl font-bold tracking-tight ${summary.grossProfit >= 0 ? "text-gray-800" : "text-red-500"}`}>
                  {formatCurrency(summary.grossProfit)}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${summary.grossProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <svg className={`w-8 h-8 ${summary.grossProfit >= 0 ? "text-emerald-500" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => {
              const colors = colorMap[card.color];
              return (
                <div key={card.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.iconBg} ${colors.text}`}>
                      {card.icon}
                    </div>
                    <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(card.amount)}</p>
                  <p className="text-xs text-gray-400">{card.sub}</p>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
