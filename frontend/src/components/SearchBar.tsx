import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  engineLabel: string;
}

export default function SearchBar({ value, onChange, onSubmit, engineLabel }: SearchBarProps) {
  return (
    <label className="relative block w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={`Search the web with ${engineLabel}`}
        className="search-input h-11 w-full rounded-lg border border-white/10 bg-[#202833]/90 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-amber-200/70 focus:ring-4 focus:ring-amber-200/10 sm:h-12 sm:pl-11 sm:pr-4"
      />
    </label>
  );
}
