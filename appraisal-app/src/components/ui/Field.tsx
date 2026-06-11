import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}

/** ラベル＋補足付きのフォーム行 */
export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium uppercase tracking-wider text-brand-500">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-brand-400">{hint}</p>}
    </div>
  );
}

const baseControl =
  "w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-800 shadow-sm outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-200";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseControl} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${baseControl} appearance-none ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}
