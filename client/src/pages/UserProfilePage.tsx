import { useEffect, useState } from 'react';
import {
  BookOpen,
  Edit2,
  Loader2,
  MapPin,
  PlusCircle,
  ShieldCheck,
  Star,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BookCard } from '@/components/books/BookCard';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { addressApi, authApi, catalogueApi, type UpdateProfileInput } from '@/services/api';
import type { Address, AddressInput, Book } from '@/types';

// ------------------------------------------------------------------ helpers

const EMPTY_ADDRESS: AddressInput = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// ------------------------------------------------------------------ edit profile modal

function EditProfileModal({
  name,
  phone,
  onClose,
  onSaved,
}: {
  name: string;
  phone: string | null;
  onClose: () => void;
  onSaved: (data: UpdateProfileInput) => void;
}) {
  const [form, setForm] = useState<UpdateProfileInput>({ name, phone: phone ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof UpdateProfileInput, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return; }
    setBusy(true);
    try {
      await authApi.updateProfile({ name: form.name.trim(), phone: form.phone?.trim() || undefined });
      onSaved({ name: form.name.trim(), phone: form.phone?.trim() || undefined });
    } catch {
      setError('Failed to update profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-paper-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Profile</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-3 border-t border-paper-200 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button type="button" onClick={handleSave} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ address form modal

function AddressModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Address;
  onClose: () => void;
  onSaved: (saved: Address) => void;
}) {
  const [form, setForm] = useState<AddressInput>(
    initial
      ? {
          fullName: initial.fullName,
          phone: initial.phone,
          line1: initial.line1,
          line2: initial.line2 ?? '',
          city: initial.city,
          state: initial.state,
          postalCode: initial.postalCode,
          country: initial.country,
          label: initial.label ?? '',
          isDefault: initial.isDefault,
        }
      : { ...EMPTY_ADDRESS },
  );
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressInput, string>>>({});

  const set = (k: keyof AddressInput, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const validate = (): boolean => {
    const e: Partial<Record<keyof AddressInput, string>> = {};
    (['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'] as const).forEach((key) => {
      if (!String(form[key] ?? '').trim()) e[key] = 'Required';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const saved = initial
        ? await addressApi.update(initial.id, form)
        : await addressApi.create(form);
      onSaved(saved);
    } catch {
      // error toast from interceptor
    } finally {
      setBusy(false);
    }
  };

  function Field({
    k,
    label,
    required,
    placeholder,
  }: {
    k: keyof AddressInput;
    label: string;
    required?: boolean;
    placeholder?: string;
  }) {
    return (
      <div>
        <label className="label">
          {label} {required && '*'}
        </label>
        <input
          className={cn('input', errors[k] && 'border-red-400')}
          value={String(form[k] ?? '')}
          placeholder={placeholder}
          onChange={(e) => set(k, e.target.value)}
        />
        {errors[k] && <p className="mt-0.5 text-xs text-red-600">{errors[k]}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-4">
        <div className="flex items-center justify-between border-b border-paper-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{initial ? 'Edit Address' : 'Add New Address'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field k="label" label="Label" placeholder="Home, Work…" /></div>
          <div className="col-span-2"><Field k="fullName" label="Full Name" required /></div>
          <div className="col-span-2"><Field k="phone" label="Phone" required /></div>
          <div className="col-span-2"><Field k="line1" label="Address Line 1" required /></div>
          <div className="col-span-2"><Field k="line2" label="Address Line 2" placeholder="Apt, suite…" /></div>
          <Field k="city" label="City" required />
          <Field k="state" label="State" required />
          <Field k="postalCode" label="ZIP / Postal Code" required />
          <Field k="country" label="Country" />
          <div className="col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.isDefault}
                onChange={(e) => set('isDefault', e.target.checked)}
                className="accent-brand-700"
              />
              Set as default address
            </label>
          </div>
        </div>
        <div className="flex gap-3 border-t border-paper-200 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button type="button" onClick={handleSave} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add address'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ address book

function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    addressApi.list().then(setAddresses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaved = (saved: Address) => {
    setAddresses((prev) => {
      const exists = prev.find((a) => a.id === saved.id);
      let next = exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved];
      if (saved.isDefault) next = next.map((a) => ({ ...a, isDefault: a.id === saved.id }));
      return next;
    });
    setAddOpen(false);
    setEditTarget(null);
  };

  const handleSetDefault = async (addr: Address) => {
    const input: AddressInput = {
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      label: addr.label ?? '',
    };
    try {
      const updated = await addressApi.setDefault(addr.id, input);
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === updated.id })),
      );
    } catch {
      // error toast from interceptor
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await addressApi.delete(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // error toast from interceptor
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 ? (
        <p className="py-6 text-center text-stone-500 text-sm">No saved addresses yet.</p>
      ) : (
        addresses.map((addr) => (
          <div
            key={addr.id}
            className={cn(
              'card p-4 flex gap-4 items-start',
              addr.isDefault && 'border-brand-300 bg-brand-50/40',
            )}
          >
            <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', addr.isDefault ? 'text-brand-600' : 'text-stone-400')} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-stone-900">{addr.fullName}</span>
                {addr.label && (
                  <span className="badge bg-paper-200 text-stone-500 text-[10px]">{addr.label}</span>
                )}
                {addr.isDefault && (
                  <span className="badge bg-brand-100 text-brand-700 text-[10px]">Default</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-stone-600 leading-relaxed">
                {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                {addr.city}, {addr.state} {addr.postalCode}<br />
                {addr.country} · {addr.phone}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {!addr.isDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(addr)}
                  className="btn-ghost text-xs gap-1 py-1 px-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Set default
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditTarget(addr)}
                className="btn-ghost text-xs gap-1 py-1 px-2"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(addr.id)}
                disabled={deleting === addr.id}
                className="btn-ghost text-xs gap-1 py-1 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                {deleting === addr.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="btn-outline w-full gap-2"
      >
        <PlusCircle className="h-4 w-4" />
        Add New Address
      </button>

      {addOpen && (
        <AddressModal onClose={() => setAddOpen(false)} onSaved={handleSaved} />
      )}
      {editTarget && (
        <AddressModal initial={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ recommendations

function PersonalisedRecs() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogueApi.recommended(8).then(setBooks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>;
  if (books.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl">
        <Star className="h-5 w-5 text-amber-500" />
        Recommended for You
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ page

type ProfileTab = 'overview' | 'addresses';

export function UserProfilePage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [editOpen, setEditOpen] = useState(false);

  if (!user) {
    return (
      <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
        <User className="h-16 w-16 text-paper-300" />
        <h1 className="text-2xl">Sign in to view your profile</h1>
        <p className="text-stone-500">You need to be logged in to access account details.</p>
      </div>
    );
  }

  const handleProfileSaved = async () => {
    await refreshUser();
    setEditOpen(false);
  };

  return (
    <main className="container-page max-w-4xl py-8 pb-16 space-y-8">
      {/* ---- profile header ---- */}
      <div className="card p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        {/* avatar */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-white text-xl font-bold shrink-0">
          {initials(user.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl">{user.name}</h1>
            <span
              className={cn(
                'badge',
                user.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-700'
                  : user.isGuest
                  ? 'bg-stone-200 text-stone-600'
                  : 'bg-brand-100 text-brand-700',
              )}
            >
              {user.isGuest ? 'Guest' : user.role === 'ADMIN' ? 'Admin' : 'Member'}
            </span>
          </div>
          {user.email && <p className="mt-0.5 text-sm text-stone-500">{user.email}</p>}
          {user.phone && <p className="text-sm text-stone-500">{user.phone}</p>}
        </div>
        {!user.isGuest && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="btn-outline gap-2 shrink-0"
          >
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </button>
        )}
      </div>

      {/* ---- wallet & points ---- */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-600 shrink-0">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Wallet Balance</p>
            <p className="text-2xl font-bold text-stone-900">{formatPrice(user.walletBalance)}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
            <Star className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Gift Points</p>
            <p className="text-2xl font-bold text-stone-900">{user.giftPoints.toLocaleString()}</p>
            <p className="text-xs text-stone-400">{formatPrice(user.giftPoints * 0.01)} value</p>
          </div>
        </div>
      </div>

      {/* ---- tabs ---- */}
      {!user.isGuest && (
        <>
          <div className="flex gap-1 rounded-xl bg-paper-100 p-1 border border-paper-300 w-fit">
            {(['overview', 'addresses'] as ProfileTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors',
                  activeTab === t
                    ? 'bg-white text-brand-700 shadow-sm border border-paper-200'
                    : 'text-stone-500 hover:text-stone-800',
                )}
              >
                {t === 'overview' ? 'Overview' : 'Address Book'}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <section className="card p-5 space-y-2">
              <h2 className="flex items-center gap-2 text-lg mb-3">
                <BookOpen className="h-5 w-5 text-brand-600" />
                Account Overview
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="flex justify-between py-2 border-b border-paper-100">
                  <span className="text-stone-500">Name</span>
                  <span className="font-medium">{user.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-paper-100">
                  <span className="text-stone-500">Email</span>
                  <span className="font-medium">{user.email ?? '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-paper-100">
                  <span className="text-stone-500">Phone</span>
                  <span className="font-medium">{user.phone ?? '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-paper-100">
                  <span className="text-stone-500">Role</span>
                  <span className="font-medium capitalize">{user.role.toLowerCase()}</span>
                </div>
              </div>
              <div className="pt-3 flex flex-wrap gap-3">
                <Link to="/orders" className="btn-primary gap-2 text-sm">
                  <BookOpen className="h-4 w-4" />
                  View Order History
                </Link>
              </div>
            </section>
          )}

          {activeTab === 'addresses' && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5 text-brand-600" />
                Address Book
              </h2>
              <AddressBook />
            </section>
          )}
        </>
      )}

      {/* ---- recommendations ---- */}
      <PersonalisedRecs />

      {editOpen && (
        <EditProfileModal
          name={user.name}
          phone={user.phone}
          onClose={() => setEditOpen(false)}
          onSaved={handleProfileSaved}
        />
      )}
    </main>
  );
}
