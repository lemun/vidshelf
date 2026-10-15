import type { ReactNode } from 'react';

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {children}
    </p>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex justify-center py-16" role="status">
      <span className="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-600" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
