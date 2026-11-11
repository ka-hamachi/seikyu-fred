"use client";

import { useEffect, useState, useCallback } from "react";
import type { DepositProvider, DepositSyncResult, HighToreDeposit } from "@/types";
import { formatCurrency, getCurrentMonth, generateMonthOptions } from "@/lib/utils";
import { DEPOSIT_PROVIDERS, DEPOSIT_PROVIDER_LABELS } from "@/lib/deposit-providers/labels";
import DepositModal from "@/components/DepositModal";

function describeSyncResult(r: DepositSyncResult): string {
  const label = DEPOSIT_PROVIDER_LABELS[r.provider];
  if (r.status === "ok") return `${label}: ${r.count}件`;
  if (r.status === "not_configured") return `${label}: 未設定`;
  if (r.status === "webhook") return `${label}: 決済ごとに自動反映`;
  return `${label}: エラー（${r.error}）`;
}

export default function HighToreDepositsPage() {
  const [deposits, setDeposits] = useState<HighToreDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<DepositSyncResult[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const monthOptions = generateMonthOptions();

  const fetchDeposits = useCallback(() => {
    fetch(`/api/hightore/deposits?month=${selectedMonth}`)
      .then((res) => res.json())
      .then((data) => {
        // エラー時（テーブル未作成など）は配列でない値が返るので空として扱う
        setDeposits(Array.isArray(data) ? data : []);
        setLoadError(Array.isArray(data) ? null : data?.error || "読み込みに失敗しました");
        setLoading(false);
      });
  }, [selectedMonth]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const handleSync = async (months: number) => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const res = await fetch("/api/hightore/deposits/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth, months }),
      });
      const data = await res.json();
      if (data.results) setSyncResults(data.results);
      else setSyncResults(null);
      if (data.error) setLoadError(data.error);
    } catch (err) {
      setLoadError(`通信エラー: ${String(err)}`);
    }
    setSyncing(false);
    fetchDeposits();
  };

  const handleAdd = async (data: { provider: DepositProvider; depositDate: string; amount: number; memo: string }) => {
    await fetch("/api/hightore/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModalOpen(false);
    fetchDeposits();
  };

  const handleDelete = async (deposit: HighToreDeposit) => {
    const isManual = deposit.externalId.startsWith("manual-");
    const message = isManual
      ? "この入金を削除しますか？"
      : "この入金を削除しますか？（APIで取り込んだ入金は、次の同期でまた取り込まれます）";
    if (!confirm(message)) return;
    await fetch(`/api/hightore/deposits?id=${deposit.id}`, { method: "DELETE" });
    fetchDeposits();
  };

  const totalAmount = deposits.reduce((sum, d) => sum + d.amount, 0);
  const byProvider = DEPOSIT_PROVIDERS.map((p) => {
    const items = deposits.filter((d) => d.provider === p.id);
    return { ...p, amount: items.reduce((sum, d) => sum + d.amount, 0), count: items.length };
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">【HT】入金売上</h1>
          <p className="text-sm text-gray-400 mt-1">
            合計 {formatCurrency(totalAmount)} / {deposits.length}件（振込日ベース）
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <select
            value={selectedMonth}
            onChange={(e) => {
              setLoading(true);
              setSyncResults(null);
              setSelectedMonth(e.target.value);
            }}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            + 手動追加
          </button>
          <button
            onClick={() => handleSync(1)}
            disabled={syncing}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {syncing ? "同期中..." : "この月を同期"}
          </button>
        </div>
      </div>

      {/* 同期結果 */}
      <div className="flex items-center justify-between gap-3 mb-6 bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-500">
          {syncResults
            ? syncResults.map(describeSyncResult).join(" / ")
            : "各サービスのAPIから、選んだ月に振り込まれた入金を取り込みます"}
        </p>
        <button
          onClick={() => handleSync(12)}
          disabled={syncing}
          className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50 shrink-0"
        >
          過去12ヶ月を同期
        </button>
      </div>

      {/* サービス別の内訳 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {byProvider.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-500 mb-2">{p.label}</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(p.amount)}</p>
            <p className="text-xs text-gray-400 mt-1">{p.count}件</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p className="text-red-500 text-sm">読み込みエラー: {loadError}</p>
        </div>
      ) : deposits.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-sm">この月の入金はありません</p>
          <p className="text-gray-300 text-xs mt-1">「この月を同期」で各サービスから取り込めます</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">振込日</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">入金元</th>
                <th className="text-right text-xs font-medium text-gray-400 px-6 py-4">入金額</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">メモ</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-700">{d.depositDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {DEPOSIT_PROVIDER_LABELS[d.provider]}
                    {d.externalId.startsWith("manual-") && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">手動</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-800">{formatCurrency(d.amount)}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{d.memo || "-"}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(d)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DepositModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleAdd} />
    </div>
  );
}
