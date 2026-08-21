import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export const TableState = ({ state, colSpan, onRetry, emptyText = "Belum ada data.", testid }) => {
  if (state === "loading") {
    return (
      <tr data-testid={`${testid}-loading`}>
        <td colSpan={colSpan} className="px-4 py-12">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat data…
          </div>
        </td>
      </tr>
    );
  }
  if (state === "error") {
    return (
      <tr data-testid={`${testid}-error`}>
        <td colSpan={colSpan} className="px-4 py-12">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertTriangle className="h-6 w-6 text-[#E03131]" />
            <p className="text-sm text-gray-600">Gagal memuat data dari server.</p>
            {onRetry && (
              <button
                data-testid={`${testid}-retry`}
                onClick={onRetry}
                className="mt-1 rounded-full bg-[#0A0A0A] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
              >
                Coba Lagi
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr data-testid={`${testid}-empty`}>
      <td colSpan={colSpan} className="px-4 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <Inbox className="h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-500">{emptyText}</p>
        </div>
      </td>
    </tr>
  );
};
