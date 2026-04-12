/**
 * Skeleton loading placeholder for contract-data views.
 * Renders a pulsing placeholder in the shape of text lines, cards, or custom sizes.
 *
 * Usage:
 *   <Skeleton />                         — single text line
 *   <Skeleton variant="card" />          — card-sized block
 *   <Skeleton width="200px" height="24px" /> — custom size
 *   <Skeleton lines={3} />              — multiple text lines
 */
export default function Skeleton({ variant = 'text', width, height, lines = 1, className = '' }) {
  const base = 'animate-pulse rounded bg-white/5';

  if (variant === 'card') {
    return (
      <div className={`${base} h-32 w-full rounded-xl ${className}`} style={{ width, height }} />
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={`${base} rounded-full ${className}`}
        style={{ width: width || '40px', height: height || '40px' }}
      />
    );
  }

  // Text lines
  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`${base} h-4`}
            style={{
              width: i === lines - 1 ? '60%' : width || '100%',
              height: height || undefined,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${base} h-4 ${className}`}
      style={{ width: width || '100%', height: height || undefined }}
    />
  );
}

/**
 * Skeleton wrapper for metric cards used across Dashboard, AgentEconomy, etc.
 */
export function MetricCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-nexus-border/20 bg-nexus-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="animate-pulse rounded bg-white/5 h-3 w-20" />
            <div className="animate-pulse rounded bg-white/5 h-4 w-4" />
          </div>
          <div className="animate-pulse rounded bg-white/5 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for table/list views (proposals, projects, agents).
 */
export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-nexus-border/10 bg-nexus-card p-3"
        >
          <div className="animate-pulse rounded-full bg-white/5 h-8 w-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="animate-pulse rounded bg-white/5 h-4 w-3/4" />
            <div className="animate-pulse rounded bg-white/5 h-3 w-1/2" />
          </div>
          <div className="animate-pulse rounded bg-white/5 h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
