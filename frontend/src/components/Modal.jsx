import { useEffect } from "react";
import { X } from "lucide-react";

export const Modal = ({ title, onClose, children, testid }) => {
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        data-testid={testid}
        className="w-full max-w-lg rounded-md border border-[#DEE2E6] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#DEE2E6] px-4 py-3">
          <h3 className="font-display text-lg font-bold tracking-tight text-[#0A0A0A]">{title}</h3>
          <button
            data-testid={testid ? `${testid}-close` : undefined}
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};
