"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DriveImportModal from "./DriveImportModal";

interface LinkedFolder {
  id: string;
  folder_id: string;
  folder_name: string;
  folder_path: string | null;
  drive_name: string | null;
  type: string;
  month: string;
}

interface LinkedFoldersProps {
  type: "sales" | "payment";
  month: string;
  accessToken: string | null;
  onSync: () => void;
}

export default function LinkedFolders({ type, month, accessToken, onSync }: LinkedFoldersProps) {
  const [folders, setFolders] = useState<LinkedFolder[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const syncLockRef = useRef(false);

  const fetchFolders = useCallback(() => {
    fetch(`/api/linked-folders?type=${type}&month=${month}`)
      .then((res) => res.json())
      .then((data) => setFolders(data));
  }, [type, month]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Sync: check linked folders for new PDFs
  const doSync = useCallback(async (silent = false) => {
    if (!accessToken || folders.length === 0) return;
    // Prevent concurrent syncs
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    if (!silent) setSyncing(true);
    if (!silent) setSyncMessage(null);
    try {
      const res = await fetch("/api/drive/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-google-token": accessToken,
        },
        body: JSON.stringify({ type, month }),
      });
      const data = await res.json();
      if (data.error) {
        if (!silent) setSyncMessage(`エラー: ${data.error}`);
      } else if (data.added > 0 || data.removed > 0) {
        const parts: string[] = [];
        if (data.added > 0) parts.push(`${data.added}件追加`);
        if (data.removed > 0) parts.push(`${data.removed}件削除`);
        setSyncMessage(parts.join(" / "));
        onSync();
      } else if (data.errors && data.errors.length > 0) {
        setSyncMessage(`エラー: ${data.errors[0]}`);
      } else if (!silent) {
        setSyncMessage("新しい請求書はありませんでした");
      }
    } catch (err) {
      if (!silent) setSyncMessage(`通信エラー: ${String(err)}`);
    }
    if (!silent) setSyncing(false);
    if (!silent) setTimeout(() => setSyncMessage(null), 5000);
    syncLockRef.current = false;
  }, [accessToken, folders.length, type, month, onSync]);

  // Sync only when manually triggered via the sync button

  const handleAddFolder = async (folderId: string, folderName: string, folderPath: string, driveName: string) => {
    await fetch("/api/linked-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId,
        folderName,
        folderPath,
        driveName,
        type,
        month,
      }),
    });
    fetchFolders();
  };

  const handleRemoveFolder = async (id: string) => {
    await fetch(`/api/linked-folders?id=${id}`, { method: "DELETE" });
    fetchFolders();
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-sm font-medium text-gray-600">連携フォルダ（{month}）</p>
        </div>
        <div className="flex items-center gap-2">
          {folders.length > 0 && accessToken && (
            <button
              onClick={() => doSync(false)}
              disabled={syncing}
              className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "同期中..." : "同期"}
            </button>
          )}
          {accessToken && (
            <button
              onClick={() => setPickerOpen(true)}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              フォルダ追加
            </button>
          )}
        </div>
      </div>

      {syncMessage && (
        <div className="mb-3 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs">
          {syncMessage}
        </div>
      )}

      {folders.length === 0 ? (
        <p className="text-xs text-gray-300">
          {accessToken ? "フォルダを追加すると、PDFが自動で取り込まれます" : "サイドバーからGoogle連携してください"}
        </p>
      ) : (
        <div className="space-y-1.5">
          {folders.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{f.folder_name}</p>
                  {f.folder_path && (
                    <p className="text-[10px] text-gray-400 truncate">{f.folder_path}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemoveFolder(f.id)}
                className="text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <DriveImportModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddFolder}
        accessToken={accessToken}
      />
    </div>
  );
}
