import type { ButtonHTMLAttributes } from 'react';

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded bg-slate-200 px-3 py-2 text-slate-900 ${props.className ?? ''}`}
    />
  );
}
