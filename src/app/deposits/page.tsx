"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";

interface Deposit {
  id: string;
  company: string;
  amount: number;
  type: "deposit" | "usage";
  description: string;
  transactionDate: string;
  createdAt: string;
}

const COMPANIES = [
  "株式会社DYM",
  "株式会社オプト",
  "株式会社ジョイプロ",
  "アンカー株式会社",
  "株式会社J・Gripマーケティング",
  "株式会社ジーニー",
];

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCompany, setModalCompany] = useState<string | null>(null);
  const [formType, setFormType] = useState<"deposit" | "usage">("deposit");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const fetchDeposits = useCallback(() => {
    setLoading(true);
    fetch("/api/deposits", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setDeposits(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const companySummaries = useMemo(() => {
    return COMPANIES.map((company) => {
      const items = deposits.filter((d) => d.company === company);
      const totalDeposit = items.filter((d) => d.type === "deposit").reduce((sum, d) => sum + d.amount, 0);
      const totalUsage = items.filter((d) => d.type === "usage").reduce((sum, d) => sum + d.amount, 0);
      const balance = totalDeposit - totalUsage;
      return { company, items, totalDeposit, totalUsage, balance };
    });
  }, [deposits]);

  const totalBalance = companySummaries.reduce((sum, s) => sum + s.balance, 0);

  const handleAdd = async () => {
    if (!modalCompany || !formAmount) return;
    await fetch("/api/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: modalCompany,
        amount: Number(formAmount.replace(/,/g, "")) || 0,
        type: formType,
        description: formDescription,
        transactionDate: formDate,
      }),
    });
    setModalCompany(null);
    setFormAmount("");
    setFormDescription("");
    setFormType("deposit");
    setFormDate(new Date().toISOString().split("T")[0]);
    fetchDeposits();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    await fetch(`/api/deposits?id=${id}`, { method: "DELETE" });
    fetchDeposits();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">デポジット</h1>
          <p className="text-sm text-gray-400 mt-1">
            デポジット残高合計 {formatCurrency(totalBalance)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {companySummaries.map(({ company, items, totalDeposit, totalUsage, balance }) => {
          const isExpanded = expandedCompany === company;
          return (
            <div key={company} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setExpandedCompany(isExpanded ? null : company)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                    {company.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{company}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      入金 {formatCurrency(totalDeposit)} / 使用 {formatCurrency(totalUsage)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">残高</p>
                    <p className={`text-lg font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalCompany(company);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    + 新規
                  </button>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isExpanded && items.length > 0 && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50">
                        <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">日付</th>
                        <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">種別</th>
                        <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">金額</th>
                        <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">備考</th>
                        <th className="text-right text-xs font-medium text-gray-400 px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d) => (
                        <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-sm text-gray-500">{d.transactionDate}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              d.type === "deposit"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-orange-50 text-orange-700"
                            }`}>
                              {d.type === "deposit" ? "入金" : "使用"}
                            </span>
                          </td>
                          <td className={`px-5 py-3 text-right text-sm font-semibold ${
                            d.type === "deposit" ? "text-emerald-600" : "text-gray-800"
                          }`}>
                            {d.type === "deposit" ? "+" : "-"}{formatCurrency(d.amount)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500">{d.description || "-"}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleDelete(d.id)}
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

              {isExpanded && items.length === 0 && (
                <div className="border-t border-gray-100 p-8 text-center text-sm text-gray-400">
                  まだ記録がありません
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalCompany && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalCompany(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">{modalCompany}</h2>
              <p className="text-sm text-gray-400 mt-0.5">デポジット記録を追加</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">種別</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "deposit" | "usage")}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                >
                  <option value="deposit">入金</option>
                  <option value="usage">使用</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">金額</label>
                <input
                  type="text"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  placeholder="100,000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">日付</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">備考</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  placeholder="任意"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCompany(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
