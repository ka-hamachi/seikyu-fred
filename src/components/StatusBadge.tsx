"use client";

interface StatusBadgeProps {
  status: "unpaid" | "paid";
  onChange?: (status: "unpaid" | "paid") => void;
  editable?: boolean;
}

export default function StatusBadge({ status, onChange, editable = true }: StatusBadgeProps) {
  if (editable && onChange) {
    return (
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as "unpaid" | "paid")}
        className={`text-xs font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          status === "paid"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        <option value="unpaid">未入金</option>
        <option value="paid">入金済み</option>
      </select>
    );
  }

  return (
    <span
      className={`text-xs font-medium px-3 py-1.5 rounded-full ${
        status === "paid"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {status === "paid" ? "入金済み" : "未入金"}
    </span>
  );
}
