"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { CreditPayment } from "@/types";
import { formatCurrency } from "@/lib/utils";
import CreditModal from "@/components/CreditModal";

type SortKey = "transactionDate" | "store" | "transactionId" | "withdrawal" | "deposit" | "cardName";
type SortDir = "asc" | "desc";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -12; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options.reverse();
}

export default function CreditPaymentsPage() {
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("transactionDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showAllStores, setShowAllStores] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const monthOptions = generateMonthOptions();

  const fetchPayments = useCallback(() => {
    setLoading(true);
    fetch(`/api/credit-payments?month=${selectedMonth}&_t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setPayments(data);
        setLoading(false);
      });
  }, [selectedMonth]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = payments;

  const handleAdd = async (data: {
    store: string;
    transactionId: string;
    withdrawal: number;
    deposit: number;
    transactionDate: string;
    cardName: string;
  }) => {
    await fetch("/api/credit-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModalOpen(false);
    fetchPayments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この支払いを削除しますか？")) return;
    const res = await fetch(`/api/credit-payments?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setPayments((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件のデータを削除しますか？`)) return;
    setBulkDeleting(true);
    const res = await fetch("/api/credit-payments/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    setSelectedIds(new Set());
    setBulkDeleting(false);
    fetchPayments();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedPayments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedPayments.map((p) => p.id)));
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/credit-payments/import-csv", {
      method: "POST",
      body: formData,
    });
    const result = await res.json();

    if (res.ok) {
      const skippedMsg = result.skipped ? `（重複${result.skipped}件スキップ）` : "";
      setImportResult(`${result.imported}件をインポートしました${skippedMsg}`);
    } else {
      setImportResult(`エラー: ${result.error}`);
    }

    setCsvUploading(false);
    fetchPayments();
    e.target.value = "";

    setTimeout(() => setImportResult(null), 3000);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "withdrawal" || key === "deposit" ? "desc" : "asc");
    }
  };

  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const cmp = typeof valA === "number" ? valA - (valB as number) : String(valA).localeCompare(String(valB));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredPayments, sortKey, sortDir]);

  // 利用先名をグループ名に正規化（数字・*・（の前までを抽出）
  const normalizeStoreName = useCallback((name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return "(未設定)";
    const match = trimmed.match(/^(.+?)[\d*（(]/);
    const group = match ? match[1].trim() : trimmed;
    return group || trimmed;
  }, []);

  // 利用先ごとの出金合計（フィルタ後・グループ化）
  const storeSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPayments) {
      const group = normalizeStoreName(p.store);
      const current = map.get(group) || 0;
      map.set(group, current + p.withdrawal);
    }
    return Array.from(map.entries())
      .map(([store, total]) => ({ store, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPayments, normalizeStoreName]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  const totalWithdrawal = filteredPayments.reduce((sum, p) => sum + p.withdrawal, 0);
  const totalDeposit = filteredPayments.reduce((sum, p) => sum + p.deposit, 0);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">クレジット支払い</h1>
          <p className="text-sm text-gray-400 mt-1">
            出金合計 {formatCurrency(totalWithdrawal)} / 入金合計 {formatCurrency(totalDeposit)} / {filteredPayments.length}件
          </p>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all cursor-pointer"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className={`px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer ${csvUploading ? "opacity-50" : ""}`}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
              disabled={csvUploading}
            />
            {csvUploading ? "インポート中..." : "CSV取り込み (UPSIDER)"}
          </label>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {bulkDeleting ? "削除中..." : `${selectedIds.size}件を削除`}
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            + 新規作成
          </button>
        </div>
      </div>

      {importResult && (
        <div className="mb-4 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl text-sm">
          {importResult}
        </div>
      )}

      {/* 利用先ごとダッシュボード */}
      {storeSummary.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">利用先ごとの出金合計</p>
          <div className="space-y-2">
            {(showAllStores ? storeSummary : storeSummary.slice(0, 10)).map(({ store, total }) => {
              const pct = totalWithdrawal > 0 ? (total / totalWithdrawal) * 100 : 0;
              return (
                <div key={store} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-gray-700 truncate flex-shrink-0" title={store}>
                    {store || "(未設定)"}
                  </div>
                  <div className="flex-1 h-6 bg-gray-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <div className="w-28 text-right text-sm font-semibold text-gray-800 flex-shrink-0">
                    {formatCurrency(total)}
                  </div>
                  <div className="w-14 text-right text-xs text-gray-400 flex-shrink-0">
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
            {storeSummary.length > 10 && (
              <button
                onClick={() => setShowAllStores(!showAllStores)}
                className="text-xs text-blue-500 hover:text-blue-700 pt-1 transition-colors"
              >
                {showAllStores ? "上位10件のみ表示" : `他 ${storeSummary.length - 10} 件の利用先を表示`}
              </button>
            )}
          </div>
        </div>
      )}

      {filteredPayments.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">この月のクレジット支払いがありません</p>
          <p className="text-gray-300 text-xs mt-1">「+ 新規作成」またはCSV取り込みで追加</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={sortedPayments.length > 0 && selectedIds.size === sortedPayments.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("transactionDate")}>
                  取引日<SortIcon column="transactionDate" />
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("store")}>
                  利用先<SortIcon column="store" />
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("transactionId")}>
                  決済ID<SortIcon column="transactionId" />
                </th>
                <th className="text-right text-xs font-medium text-gray-400 px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("withdrawal")}>
                  出金金額<SortIcon column="withdrawal" />
                </th>
                <th className="text-right text-xs font-medium text-gray-400 px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("deposit")}>
                  入金金額<SortIcon column="deposit" />
                </th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-4 cursor-pointer select-none" onClick={() => handleSort("cardName")}>
                  カード名<SortIcon column="cardName" />
                </th>
                <th className="text-right text-xs font-medium text-gray-400 px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((p) => (
                <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${selectedIds.has(p.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.transactionDate}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-800">{p.store}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 font-mono">{p.transactionId || "-"}</td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-800">
                    {p.withdrawal > 0 ? formatCurrency(p.withdrawal) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-600">
                    {p.deposit > 0 ? formatCurrency(p.deposit) : "-"}
                  </td>
                  <td className="px-6 py-4">
                    {p.cardName && (
                      <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-50 text-gray-500">
                        {p.cardName}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
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

      <CreditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAdd}
      />
    </div>
  );
}
