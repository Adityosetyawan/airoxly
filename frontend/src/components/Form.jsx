export const inputCls =
  "w-full rounded-md border border-[#DEE2E6] bg-white px-3 py-2 text-sm text-[#0A0A0A] outline-none transition-colors placeholder:text-gray-400 focus:border-[#0A0A0A]";

export const Field = ({ label, children, testid }) => (
  <div data-testid={testid}>
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</label>
    {children}
  </div>
);
