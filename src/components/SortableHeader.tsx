"use client";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  align?: "left" | "right";
}

export default function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, align = "left" }: SortableHeaderProps) {
  const isActive = currentSort === sortKey;

  return (
    <th
      className={`text-xs font-medium px-6 py-4 cursor-pointer select-none hover:text-gray-600 transition-colors ${
        align === "right" ? "text-right" : "text-left"
      } ${isActive ? "text-gray-600" : "text-gray-400"}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg className={`w-3 h-3 ${isActive ? "text-blue-500" : "text-gray-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isActive && currentDir === "asc" ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          ) : isActive && currentDir === "desc" ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          )}
        </svg>
      </span>
    </th>
  );
}
