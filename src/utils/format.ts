export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value === 0) return '$0.00';
  if (Math.abs(value) < 0.01) return `$${value.toFixed(4)}`;
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTokens(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'never';
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function createId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Redact a key for UI display — never log the full value. */
export function maskCredential(apiKey: string | null | undefined): string {
  if (!apiKey) return '—';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}
