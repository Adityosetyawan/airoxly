import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";

export const ConfirmDialog = ({ title, message, onConfirm, onClose, loading, testid }) => (
  <Modal title={title} onClose={onClose} testid={testid}>
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#E03131]" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
    <div className="mt-6 flex justify-end gap-2">
      <button
        data-testid={testid ? `${testid}-cancel` : undefined}
        onClick={onClose}
        className="rounded-full border border-[#DEE2E6] px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A]"
      >
        Batal
      </button>
      <button
        data-testid={testid ? `${testid}-confirm` : undefined}
        onClick={onConfirm}
        disabled={loading}
        className="flex items-center gap-2 rounded-full bg-[#E03131] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c92a2a] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Hapus
      </button>
    </div>
  </Modal>
);
