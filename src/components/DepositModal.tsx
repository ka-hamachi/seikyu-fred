"use client";

import { useState } from "react";
import type { DepositProvider } from "@/types";
import { DEPOSIT_PROVIDERS } from "@/lib/deposit-providers/labels";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { provider: DepositProvider; depositDate: string; amount: number; memo: string }) => void;
}

const inputClass =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all";

export default function DepositModal({ isOpen, onClose, onSubmit }: DepositModalProps) {
  const [provider, setProvider] = useState<DepositProvider>("fincode");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ provider, depositDate, amount: Number(amount.replace(/,/g, "")) || 0, memo });
    setAmount("");
    setMemo("");
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">入金を手動で追加</h2>
          <p className="text-xs text-gray-400 mt-1">APIで取り込めない入金の補正用です。同期で取り込まれる入金を追加すると二重に計上されます。</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">入金元</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as DepositProvider)} className={inputClass}>
              {DEPOSIT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">振込日</label>
              <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">入金額</label>
              <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} placeholder="100,000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">メモ</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} className={inputClass} placeholder="備考..." />
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
