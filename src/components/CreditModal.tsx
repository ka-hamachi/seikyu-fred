"use client";

import { useState } from "react";

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    store: string;
    transactionId: string;
    withdrawal: number;
    deposit: number;
    transactionDate: string;
    cardName: string;
  }) => void;
  initial?: {
    store: string;
    transactionId: string;
    withdrawal: number;
    deposit: number;
    transactionDate: string;
    cardName: string;
  };
}

export default function CreditModal({ isOpen, onClose, onSubmit, initial }: CreditModalProps) {
  const [store, setStore] = useState(initial?.store || "");
  const [transactionId, setTransactionId] = useState(initial?.transactionId || "");
  const [withdrawal, setWithdrawal] = useState(initial?.withdrawal?.toString() || "");
  const [deposit, setDeposit] = useState(initial?.deposit?.toString() || "0");
  const [transactionDate, setTransactionDate] = useState(initial?.transactionDate || new Date().toISOString().split("T")[0]);
  const [cardName, setCardName] = useState(initial?.cardName || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      store,
      transactionId,
      withdrawal: Number(withdrawal.replace(/,/g, "")) || 0,
      deposit: Number(deposit.replace(/,/g, "")) || 0,
      transactionDate,
      cardName,
    });
    setStore("");
    setTransactionId("");
    setWithdrawal("");
    setDeposit("0");
    setTransactionDate(new Date().toISOString().split("T")[0]);
    setCardName("");
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">クレジット支払い追加</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">利用先</label>
            <input
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="Amazon / Google Workspace"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">決済ID</label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="任意"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">出金金額</label>
              <input
                type="text"
                value={withdrawal}
                onChange={(e) => setWithdrawal(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                placeholder="10,000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">入金金額</label>
              <input
                type="text"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">取引日</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">カード名</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                placeholder="UPSIDER メインカード"
              />
            </div>
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
