import { cn } from '@/lib/cn';

const LABEL: Record<string, string> = {
  PAPERBACK: 'Paperback',
  HARDCOVER: 'Hardcover',
  EBOOK: 'E-Book',
};

const COLORS: Record<string, string> = {
  PAPERBACK: 'bg-brand-100 text-brand-800',
  HARDCOVER: 'bg-ink-100 text-ink-800',
  EBOOK: 'bg-emerald-100 text-emerald-800',
};

export function FormatBadge({ format }: { format: string }) {
  return (
    <span className={cn('badge text-[10px]', COLORS[format] ?? 'bg-stone-100 text-stone-600')}>
      {LABEL[format] ?? format}
    </span>
  );
}
