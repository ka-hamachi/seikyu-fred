// 在庫の入力方法が決まるまでの空の画面
export default function HighToreInventoryPage() {
  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">【HT】在庫</h1>
      <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
        <p className="text-gray-400 text-sm">準備中です</p>
      </div>
    </div>
  );
}
