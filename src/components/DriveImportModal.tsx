"use client";

import { useState, useEffect, useCallback } from "react";

interface DriveEntry {
  id: string;
  name: string;
  type?: "my" | "shared";
}

interface BreadcrumbItem {
  id: string;
  name: string;
  driveId?: string;
}

interface DriveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string, folderName: string, folderPath: string, driveName: string) => void;
  accessToken: string | null;
}

export default function DriveImportModal({
  isOpen,
  onClose,
  onSelect,
  accessToken,
}: DriveImportModalProps) {
  const [drives, setDrives] = useState<DriveEntry[]>([]);
  const [sharedDrives, setSharedDrives] = useState<DriveEntry[]>([]);
  const [folders, setFolders] = useState<DriveEntry[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [currentDriveId, setCurrentDriveId] = useState<string | undefined>();
  const [currentDriveName, setCurrentDriveName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<DriveEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<"root" | "shared-drives" | "folders">("root");

  const fetchRoot = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await fetch("/api/drive/folders", {
      headers: { "x-google-token": accessToken },
    });
    const data = await res.json();
    // Separate my drive and shared drives
    const myDrive = (data.drives || []).filter((d: DriveEntry & { type: string }) => d.type === "my");
    const shared = (data.drives || []).filter((d: DriveEntry & { type: string }) => d.type === "shared");
    setDrives(myDrive);
    setSharedDrives(shared);
    setFolders([]);
    setBreadcrumb([]);
    setCurrentDriveId(undefined);
    setCurrentDriveName("");
    setSelectedFolder(null);
    setLevel("root");
    setLoading(false);
  }, [accessToken]);

  const fetchSubfolders = useCallback(async (parentId: string, driveId?: string) => {
    if (!accessToken) return;
    setLoading(true);
    setSelectedFolder(null);
    const params = new URLSearchParams({ parentId });
    if (driveId) params.set("driveId", driveId);

    const res = await fetch(`/api/drive/folders?${params}`, {
      headers: { "x-google-token": accessToken },
    });
    const data = await res.json();
    setFolders(data.folders || []);
    setLevel("folders");
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    if (isOpen && accessToken) {
      fetchRoot();
    }
  }, [isOpen, accessToken, fetchRoot]);

  const handleMyDriveClick = () => {
    setCurrentDriveId(undefined);
    setCurrentDriveName("マイドライブ");
    setBreadcrumb([{ id: "root", name: "マイドライブ" }]);
    fetchSubfolders("root");
  };

  const handleSharedDrivesClick = () => {
    setLevel("shared-drives");
    setSelectedFolder(null);
  };

  const handleSharedDriveSelect = (sd: DriveEntry) => {
    setCurrentDriveId(sd.id);
    setCurrentDriveName(sd.name);
    setBreadcrumb([{ id: sd.id, name: sd.name, driveId: sd.id }]);
    fetchSubfolders(sd.id, sd.id);
  };

  const handleFolderClick = (folder: DriveEntry) => {
    // Single click = select
    setSelectedFolder(folder);
  };

  const handleFolderDoubleClick = (folder: DriveEntry) => {
    // Double click = navigate into
    setSelectedFolder(null);
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name, driveId: currentDriveId }]);
    fetchSubfolders(folder.id, currentDriveId);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      fetchRoot();
      return;
    }
    const target = breadcrumb[index];
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    setCurrentDriveId(target.driveId);
    setSelectedFolder(null);
    fetchSubfolders(target.id, target.driveId);
  };

  const handleSelect = () => {
    if (!selectedFolder) return;
    const pathParts = breadcrumb.map((b) => b.name);
    pathParts.push(selectedFolder.name);
    onSelect(selectedFolder.id, selectedFolder.name, pathParts.join(" / "), currentDriveName);
    onClose();
  };

  // Also allow selecting the current folder (the breadcrumb folder itself)
  const handleSelectCurrentFolder = () => {
    if (breadcrumb.length === 0) return;
    const current = breadcrumb[breadcrumb.length - 1];
    const pathParts = breadcrumb.map((b) => b.name);
    onSelect(current.id, current.name, pathParts.join(" / "), currentDriveName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">フォルダを選択</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            クリックで選択、ダブルクリックでフォルダを開く
          </p>
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="px-6 pt-4 flex items-center gap-1 text-xs text-gray-400 flex-wrap">
            <button onClick={() => handleBreadcrumbClick(-1)} className="hover:text-blue-500 transition-colors">
              ドライブ
            </button>
            {breadcrumb.map((item, i) => (
              <span key={`${item.id}-${i}`} className="flex items-center gap-1">
                <span className="text-gray-300">/</span>
                {i < breadcrumb.length - 1 ? (
                  <button onClick={() => handleBreadcrumbClick(i)} className="hover:text-blue-500 transition-colors">
                    {item.name}
                  </button>
                ) : (
                  <span className="text-gray-600 font-medium">{item.name}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {!accessToken ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Googleアカウントに接続してください</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">読み込み中...</p>
            </div>
          ) : level === "root" ? (
            /* Root: マイドライブ / 共有ドライブ */
            <div className="space-y-1">
              {drives.length > 0 && (
                <button
                  onClick={handleMyDriveClick}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">マイドライブ</p>
                  </div>
                </button>
              )}
              {sharedDrives.length > 0 && (
                <button
                  onClick={handleSharedDrivesClick}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-50">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">共有ドライブ</p>
                    <p className="text-[10px] text-gray-400">{sharedDrives.length}件</p>
                  </div>
                </button>
              )}
            </div>
          ) : level === "shared-drives" ? (
            /* Shared drives list */
            <div className="space-y-1">
              <button
                onClick={() => setLevel("root")}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-500 mb-3 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
              {sharedDrives.map((sd) => (
                <button
                  key={sd.id}
                  onClick={() => handleSharedDriveSelect(sd)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-50">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700">{sd.name}</p>
                </button>
              ))}
            </div>
          ) : (
            /* Folder list */
            <div className="space-y-1">
              {folders.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">サブフォルダがありません</p>
              )}
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFolderClick(f)}
                  onDoubleClick={() => handleFolderDoubleClick(f)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    selectedFolder?.id === f.id
                      ? "bg-blue-50 ring-1 ring-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-50">
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700">{f.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {level === "folders" && (
          <div className="p-6 border-t border-gray-100 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            {selectedFolder ? (
              <button
                onClick={handleSelect}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                「{selectedFolder.name}」を選択
              </button>
            ) : (
              <button
                onClick={handleSelectCurrentFolder}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                現在のフォルダを選択
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
