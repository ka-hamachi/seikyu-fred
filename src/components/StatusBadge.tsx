"use client";

interface StatusBadgeProps {
  status: string;
  onChange?: (status: string) => void;
  editable?: boolean;
  showNotRequired?: boolean;
}

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-amber-50 text-amber-700",
  not_required: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, string> = {
  unpaid: "未入金",
  paid: "入金済み",
  not_required: "入金不要",
};

export default function StatusBadge({ status, onChange, editable = true, showNotRequired = false }: StatusBadgeProps) {
  if (editable && onChange) {
    return (
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${statusStyles[status] || statusStyles.unpaid}`}
      >
        <option value="unpaid">未入金</option>
        <option value="paid">入金済み</option>
        {showNotRequired && <option value="not_required">入金不要</option>}
      </select>
    );
  }

  return (
    <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${statusStyles[status] || statusStyles.unpaid}`}>
      {statusLabels[status] || "未入金"}
    </span>
  );
}
