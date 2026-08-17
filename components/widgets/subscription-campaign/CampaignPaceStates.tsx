export function CampaignPaceStateMessage({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="flex h-[280px] items-center justify-center px-4 text-center sm:h-[300px]">
      <div>
        {title ? (
          <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
        ) : null}
        <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
      </div>
    </div>
  );
}
