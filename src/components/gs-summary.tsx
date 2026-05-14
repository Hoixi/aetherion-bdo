interface GsSummaryProps {
  ap: number;
  dp: number;
}

export function GsSummary({ ap, dp }: GsSummaryProps) {
  const gs = ap + dp;

  return (
    <div className="flex gap-3">
      <div className="flex-1 bg-bdo-surface border border-bdo-border rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-bdo-gold font-mono">{ap}</div>
        <div className="text-xs text-bdo-text-muted uppercase mt-1">AP</div>
      </div>
      <div className="flex-1 bg-bdo-surface border border-bdo-border rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-bdo-gold font-mono">{dp}</div>
        <div className="text-xs text-bdo-text-muted uppercase mt-1">DP</div>
      </div>
      <div className="flex-1 bg-bdo-surface border border-bdo-gold/30 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-bdo-gold font-mono">{gs}</div>
        <div className="text-xs text-bdo-text-muted uppercase mt-1">GS</div>
      </div>
    </div>
  );
}
