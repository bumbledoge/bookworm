export type ToastType = 'success' | 'error' | 'info';

export interface ToastPayload {
  type: ToastType;
  message: string;
}

type Listener = (toast: ToastPayload) => void;

const listeners = new Set<Listener>();

/**
 * Lets non-React code (e.g. the Axios interceptors) raise toasts.
 * `ToastProvider` subscribes to this bus.
 */
export const toastBus = {
  emit(toast: ToastPayload) {
    listeners.forEach((l) => l(toast));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
