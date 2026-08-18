"use client";

import { useState, type ReactNode } from "react";

export type MobileKpiItem = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

export function MobileRecordCard({
  title,
  subtitle,
  kpis,
  details,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  kpis: MobileKpiItem[];
  details?: MobileKpiItem[];
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(details && details.length > 0);

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium leading-snug text-[var(--foreground)]">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs leading-snug">
        {kpis.map((item) => (
          <div key={item.label} className={item.wide ? "col-span-2" : undefined}>
            <dt className="text-[var(--muted)]">{item.label}</dt>
            <dd className="font-medium text-[var(--foreground)]">{item.value}</dd>
          </div>
        ))}
      </dl>
      {hasDetails ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-3 min-h-11 w-full rounded-md border border-[var(--border)] bg-white text-sm font-medium"
          aria-expanded={open}
        >
          {open ? "Скрыть" : "Подробнее"}
        </button>
      ) : null}
      {open && details ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs leading-snug">
          {details.map((item) => (
            <div key={item.label} className={item.wide ? "col-span-2" : undefined}>
              <dt className="text-[var(--muted)]">{item.label}</dt>
              <dd className="text-[var(--foreground)]">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {extra}
    </article>
  );
}
