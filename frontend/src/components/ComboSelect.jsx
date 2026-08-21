import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export const ComboSelect = ({ items, value, onChange, placeholder = "Pilih…", testid }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = items.find((i) => i.id === value);
  const filtered = items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 50);

  return (
    <div className="relative" data-testid={testid}>
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
      <button
        type="button"
        data-testid={testid ? `${testid}-trigger` : undefined}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-[#DEE2E6] bg-white px-3 py-2 text-sm transition-colors focus:border-[#0A0A0A]"
      >
        <span className={selected ? "text-[#0A0A0A]" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-[#DEE2E6] bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-[#F1F3F5] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              data-testid={testid ? `${testid}-search` : undefined}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik untuk mencari…"
              className="w-full text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Tidak ditemukan.</p>}
            {filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                data-testid={testid ? `${testid}-option-${i.id}` : undefined}
                onClick={() => {
                  onChange(i.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-[#F8F9FA]"
              >
                <span className="truncate">{i.label}</span>
                {i.id === value && <Check className="h-4 w-4 shrink-0 text-[#0A0A0A]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
