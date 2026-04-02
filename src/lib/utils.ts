export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isCurrentMonth(dateStr: string): boolean {
  const current = getCurrentMonth();
  return dateStr.startsWith(current);
}

export function getMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
}
