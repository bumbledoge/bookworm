import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/context/ToastContext';

const STYLES = {
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2, icon: 'text-emerald-600' },
  error: { box: 'border-red-200 bg-red-50 text-red-900', Icon: AlertCircle, icon: 'text-red-600' },
  info: { box: 'border-ink-200 bg-ink-50 text-ink-900', Icon: Info, icon: 'text-ink-600' },
} as const;

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const { box, Icon, icon } = STYLES[t.type];
        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border p-3 shadow-card-hover',
              box,
            )}
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
