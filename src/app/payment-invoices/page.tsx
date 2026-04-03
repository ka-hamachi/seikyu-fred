"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { PaymentInvoice } from "@/types";
import { formatCurrency } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import InvoiceModal from "@/components/InvoiceModal";
import LinkedFolders from "@/components/LinkedFolders";
import SortableHeader from "@/components/SortableHeader";

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

export default function PaymentInvoicesPage() {
  const { data: session } = useSession();
  const accessToken = (session as unknown as Record<string, string>)?.accessToken || null;

  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const monthOptions = generateMonthOptions();

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const fetchInvoices = useCallback(() => {
    fetch("/api/payment-invoices")
      .then((res) => res.json())
      .then((data) => {
        setInvoices(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleAdd = async (data: {
    client: string;
    amount: number;
    status: "unpaid" | "paid";
    issueDate: string;
    dueDate: string;
    memo: string;
  }) => {
    await fetch("/api/payment-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModalOpen(false);
    fetchInvoices();
  };

  const handleStatusChange = async (id: string, status: "unpaid" | "paid") => {
    await fetch("/api/payment-invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchInvoices();
  };

  const handleCheckStatusChange = async (id: string, checkStatus: "unchecked" | "checked") => {
    await fetch("/api/payment-invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checkStatus }),
    });
    fetchInvoices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この請求書を削除しますか？")) return;
    await fetch(`/api/payment-invoices?id=${id}`, { method: "DELETE" });
    fetchInvoices();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の請求書を削除しますか？`)) return;
    setBulkActing(true);
    await fetch(`/api/payment-invoices?ids=${Array.from(selectedIds).join(",")}`, { method: "DELETE" });
    setSelectedIds(new Set());
    setBulkActing(false);
    fetchInvoices();
  };

  const handleBulkStatusChange = async (status: "unpaid" | "paid") => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    await fetch("/api/payment-invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    });
    setSelectedIds(new Set());
    setBulkActing(false);
    fetchInvoices();
  };

  const handleBulkCheckStatusChange = async (checkStatus: "unchecked" | "checked") => {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    await fetch("/api/payment-invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), checkStatus }),
    });
    setSelectedIds(new Set());
    setBulkActing(false);
    fetchInvoices();
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
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((inv) => inv.id)));
    }
  };

  const filteredInvoices = invoices.filter((inv) => inv.issueDate.startsWith(selectedMonth));
  if (sortKey) {
    filteredInvoices.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "client") cmp = a.client.localeCompare(b.client, "ja");
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "sourceFolder") cmp = (a.sourceFolder || "").localeCompare(b.sourceFolder || "", "ja");
      else if (sortKey === "checkStatus") cmp = a.checkStatus.localeCompare(b.checkStatus);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const unpaidCount = filteredInvoices.filter((inv) => inv.status === "unpaid").length;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">支払い請求書</h1>
          <p className="text-sm text-gray-400 mt-1">
            合計 {formatCurrency(totalAmount)} / 未支払い {unpaidCount}件
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => handleBulkCheckStatusChange("checked")}
                disabled={bulkActing}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50"
              >
                確認済にする
              </button>
              <button
                onClick={() => handleBulkCheckStatusChange("unchecked")}
                disabled={bulkActing}
                className="px-4 py-2.5 bg-red-400 text-white rounded-xl text-sm font-medium hover:bg-red-500 transition-colors shadow-sm disabled:opacity-50"
              >
                未確認にする
              </button>
              <button
                onClick={() => handleBulkStatusChange("paid")}
                disabled={bulkActing}
                className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
              >
                支払済にする
              </button>
              <button
                onClick={() => handleBulkStatusChange("unpaid")}
                disabled={bulkActing}
                className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50"
              >
                未支払にする
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkActing}
                className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
              >
                {selectedIds.size}件を削除
              </button>
            </>
          )}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            + 新規作成
          </button>
        </div>
      </div>

      {/* Linked Folders */}
      <LinkedFolders
        type="payment"
        month={selectedMonth}
        accessToken={accessToken}
        onSync={fetchInvoices}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">支払い請求書がありません</p>
          <p className="text-gray-300 text-xs mt-1">「+ 新規作成」またはフォルダ連携で追加</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <SortableHeader label="請求者" sortKey="client" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="金額" sortKey="amount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortableHeader label="格納元ドライブ" sortKey="sourceFolder" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="チェック" sortKey="checkStatus" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="ステータス" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="text-right text-xs font-medium text-gray-400 px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${selectedIds.has(inv.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    {inv.driveFileId ? (
                      <a href={`https://drive.google.com/file/d/${inv.driveFileId}/view`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">{inv.client}</a>
                    ) : (
                      <div className="text-sm font-medium text-gray-800">{inv.client}</div>
                    )}
                    {inv.pdfFileName && <div className="text-xs text-gray-400 mt-0.5">{inv.pdfFileName}</div>}
                    {inv.memo && <div className="text-xs text-gray-400 mt-0.5">{inv.memo}</div>}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-800">{formatCurrency(inv.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.sourceFolder || "-"}</td>
                  <td className="px-6 py-4">
                    <select
                      value={inv.checkStatus}
                      onChange={(e) => handleCheckStatusChange(inv.id, e.target.value as "unchecked" | "checked")}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        inv.checkStatus === "checked"
                          ? "bg-blue-100 text-blue-700 focus:ring-blue-300"
                          : "bg-red-100 text-red-700 focus:ring-red-300"
                      }`}
                    >
                      <option value="unchecked">未確認</option>
                      <option value="checked">確認済</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={inv.status} onChange={(status) => handleStatusChange(inv.id, status)} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(inv.id)} className="text-gray-300 hover:text-red-400 transition-colors">
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

      <InvoiceModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleAdd} title="支払い請求書を追加" />
    </div>
  );
}
