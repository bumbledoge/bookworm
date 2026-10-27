import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Closes on Escape and locks page scroll while an overlay is open. */
function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

interface DrawerProps extends OverlayProps {
  side?: 'left' | 'right';
  footer?: ReactNode;
}

/** Slide-over panel used for the cart flyout and mobile navigation. */
export function Drawer({ open, onClose, title, side = 'right', footer, children }: DrawerProps) {
  useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-stone-900/50" onClick={onClose} />
      <div
        className={cn(
          'absolute top-0 flex h-full w-full max-w-sm flex-col bg-paper-50 shadow-2xl',
          side === 'right' ? 'right-0 animate-slide-in-right' : 'left-0 animate-slide-in-left',
        )}
      >
        <div className="flex items-center justify-between border-b border-paper-300 px-4 py-3">
          <h2 className="text-lg">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label={`Close ${title}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-paper-300 bg-white p-4">{footer}</div>}
      </div>
    </div>
  );
}

/** Centered dialog. */
export function Modal({ open, onClose, title, children }: OverlayProps) {
  useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 animate-fade-in bg-stone-900/50" onClick={onClose} />
      <div className="card relative max-h-[90vh] w-full max-w-md animate-fade-in overflow-y-auto bg-paper-50 p-6">
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost absolute right-3 top-3 p-2"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="mb-4 pr-8 text-xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}
