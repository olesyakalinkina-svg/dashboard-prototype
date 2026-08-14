export function DashboardLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6"
      suppressHydrationWarning
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--foreground)]" />
        <p className="text-sm text-[var(--muted)]">Загрузка данных…</p>
      </div>
    </div>
  );
}
