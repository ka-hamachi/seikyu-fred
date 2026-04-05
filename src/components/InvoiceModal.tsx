"use client";

import { useState } from "react";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    client: string;
    amount: number;
    status: "unpaid" | "paid" | "not_required";
    issueDate: string;
    dueDate: string;
    memo: string;
  }) => void;
  title: string;
  showNotRequired?: boolean;
  initial?: {
    client: string;
    amount: number;
    status: "unpaid" | "paid" | "not_required";
    issueDate: string;
    dueDate: string;
    memo: string;
  };
}

export default function InvoiceModal({ isOpen, onClose, onSubmit, title, showNotRequired = false, initial }: InvoiceModalProps) {
  const [client, setClient] = useState(initial?.client || "");
  const [amount, setAmount] = useState(initial?.amount?.toString() || "");
  const [status, setStatus] = useState<"unpaid" | "paid" | "not_required">(initial?.status || "unpaid");
  const [issueDate, setIssueDate] = useState(initial?.issueDate || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [memo, setMemo] = useState(initial?.memo || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      client,
      amount: Number(amount.replace(/,/g, "")) || 0,
      status,
      issueDate,
      dueDate,
      memo,
    });
    setClient("");
    setAmount("");
    setStatus("unpaid");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setMemo("");
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">{title.includes("支払い") ? "請求者" : "請求先"}</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="株式会社〇〇"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">金額</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="100,000"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">発行日</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">支払期日</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "unpaid" | "paid" | "not_required")}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            >
              <option value="unpaid">未入金</option>
              <option value="paid">入金済み</option>
              {showNotRequired && <option value="not_required">入金不要</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">メモ</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all resize-none"
              placeholder="備考..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
