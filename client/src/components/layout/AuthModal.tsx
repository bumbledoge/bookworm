import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Overlay';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/cn';

type Mode = 'login' | 'register';

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, register, isGuest } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
        toast.success('Welcome back!');
      } else {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
        });
        toast.success('Account created. Welcome to Book Worm!');
      }
      setForm({ name: '', email: '', password: '', phone: '' });
      onClose();
    } catch {
      // Error toast is raised by the Axios interceptor.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'login' ? 'Sign in to Book Worm' : 'Create your account'}>
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-paper-200 p-1 text-sm font-semibold" role="tablist">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('rounded-md py-1.5', mode === m ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-600')}
          >
            {m === 'login' ? 'Sign in' : 'Register'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div>
            <label className="label" htmlFor="auth-name">Full name</label>
            <input id="auth-name" className="input" required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" className="input" required value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            className="input"
            required
            minLength={mode === 'register' ? 8 : 1}
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {mode === 'register' && (
          <div>
            <label className="label" htmlFor="auth-phone">Phone (optional)</label>
            <input id="auth-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </div>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        {isGuest && (
          <p className="text-center text-xs text-stone-500">Items in your guest cart will be kept when you sign in.</p>
        )}
      </form>
    </Modal>
  );
}
