"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { HighToreDashboardSummary } from "@/types";
import { formatCurrency, getCurrentMonth, generateMonthOptions } from "@/lib/utils";
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
          (data.months || []).map((m: { month: number; label: string; payments: number }) => ({
            month: m.month,
            label: m.label,
            value: m.payments,
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

      {/* 年間支払い推移グラフ */}
      {yearlyData.length > 0 && (
        <MonthlyBarChart title={`${currentYear}年 支払い推移`} data={yearlyData} tone="cost" />
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
          {/* Payments Total Card */}
          <Link
            href="/hightore/payment-invoices"
            className="block bg-white rounded-2xl p-5 md:p-8 mb-6 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-2">{selectedLabel}の支払い請求書</p>
                <p className="text-2xl md:text-4xl font-bold tracking-tight text-gray-800">
                  {formatCurrency(summary.totalPayments)}
                </p>
                <p className="text-xs text-gray-400 mt-2">{summary.paymentsCount}件</p>
              </div>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-orange-50">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">未支払い</p>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(summary.unpaidPaymentsAmount)}</p>
              <p className="text-xs text-gray-400">{summary.unpaidPaymentsCount}件</p>
            </div>
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
              <p className="text-xs text-gray-400">チェックが「未確認」の請求書</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
