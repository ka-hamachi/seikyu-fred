"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { HighToreDashboardSummary } from "@/types";
import { formatCurrency, getCurrentMonth, generateMonthOptions } from "@/lib/utils";
import { DEPOSIT_PROVIDERS } from "@/lib/deposit-providers/labels";
import MonthlyBarChart, { type MonthlyBarData } from "@/components/MonthlyBarChart";

export default function HighToreDashboard() {
  const [summary, setSummary] = useState<HighToreDashboardSummary | null>(null);
  const [yearlyData, setYearlyData] = useState<MonthlyBarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const monthOptions = generateMonthOptions();
  const currentYear = new Date().getFullYear();

  const fetchSummary = useCallback((month: string) => {
    fetch(`/api/hightore/dashboard?month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        setSummary(data.error ? null : data);
        setLoadError(data.error || null);
        setLoading(false);
      });
  }, []);

  const fetchYearly = useCallback(() => {
    fetch(`/api/hightore/dashboard/yearly?year=${currentYear}`)
      .then((res) => res.json())
      .then((data) =>
        setYearlyData(
          (data.months || []).map((m: { month: number; label: string; grossProfit: number }) => ({
            month: m.month,
            label: m.label,
            value: m.grossProfit,
          }))
        )
      );
  }, [currentYear]);

  useEffect(() => {
    fetchSummary(selectedMonth);
  }, [selectedMonth, fetchSummary]);

  useEffect(() => {
    fetchYearly();
  }, [fetchYearly]);

  const selectedLabel = monthOptions.find((o) => o.value === selectedMonth)?.label || "";

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between gap-3 mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">【HighTore】ダッシュボード</h1>
        <select
          value={selectedMonth}
          onChange={(e) => {
            setLoading(true);
            setSelectedMonth(e.target.value);
          }}
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
        <MonthlyBarChart title={`${currentYear}年 粗利推移`} data={yearlyData} tone="profit" />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p className="text-red-500 text-sm">読み込みエラー: {loadError}</p>
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
                <p className="text-xs text-gray-400 mt-2">入金売上 − 支払い請求書</p>
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
            <Link
              href="/hightore/deposits"
              className="block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">入金売上</p>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-2">{formatCurrency(summary.totalDeposits)}</p>
              <div className="space-y-0.5">
                {DEPOSIT_PROVIDERS.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs text-gray-400">
                    <span>{p.label}</span>
                    <span>{formatCurrency(summary.depositsByProvider[p.id])}</span>
                  </div>
                ))}
              </div>
            </Link>
            <Link
              href="/hightore/payment-invoices"
              className="block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-100 text-orange-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">支払い請求書</p>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(summary.totalPayments)}</p>
              <p className="text-xs text-gray-400">
                {summary.paymentsCount}件 / 未支払い: {summary.unpaidPaymentsCount}件（{formatCurrency(summary.unpaidPaymentsAmount)}）
              </p>
            </Link>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">未確認</p>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{summary.uncheckedPaymentsCount}件</p>
              <p className="text-xs text-gray-400">チェックが「未確認」の支払い請求書</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
