import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Image as ImageIcon, Loader2, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { Header } from './Header';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Creator } from '../types/domain';

type CreatorForm = {
  name: string;
  description: string;
  imageUrl: string;
};

const emptyForm: CreatorForm = { name: '', description: '', imageUrl: '' };

export default function AdminCreatorsPage() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatorForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const selectedCreator = useMemo(() => creators.find(creator => creator.id === selectedCreatorId) ?? null, [creators, selectedCreatorId]);

  const load = async () => {
    const data = await api<Creator[]>('/creators');
    setCreators(data);
  };

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'ADMIN') return;
    void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load creators'));
  }, [loading, user]);

  useEffect(() => {
    if (!selectedCreator) {
      setForm(emptyForm);
      return;
    }
    setForm({
      name: selectedCreator.name,
      description: selectedCreator.description ?? '',
      imageUrl: selectedCreator.imageUrl ?? '',
    });
  }, [selectedCreator]);

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-white" />;
  }

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const reset = () => {
    setSelectedCreatorId(null);
    setForm(emptyForm);
    setError('');
    setStatus('');
  };

  const updateForm = <K extends keyof CreatorForm>(key: K, value: CreatorForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const saveCreator = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
      };
      if (!payload.name) throw new Error('Name is required');
      if (selectedCreator) {
        await api<Creator>('/creators/' + selectedCreator.id, { method: 'PUT', body: JSON.stringify(payload) });
        setStatus('Creator updated');
      } else {
        await api<Creator>('/creators', { method: 'POST', body: JSON.stringify(payload) });
        setStatus('Creator created');
      }
      await load();
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save creator');
    } finally {
      setBusy(false);
    }
  };

  const deleteCreator = async () => {
    if (!selectedCreator) return;
    if (!window.confirm('Delete ' + selectedCreator.name + '?')) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await api('/creators/' + selectedCreator.id, { method: 'DELETE' });
      setStatus('Creator deleted');
      await load();
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete creator');
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setStatus('Uploading image to Cloudinary…');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api<{ imageUrl: string }>('/creators/upload', { method: 'POST', body: formData });
      setForm(current => ({ ...current, imageUrl: response.imageUrl }));
      setStatus('Image uploaded');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload image');
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  return <div className="min-h-screen bg-[#050505] text-white">
    <Header
      type="landing"
      user={user}
      onGoToLanding={() => navigate('/')}
      onLogout={() => void logout()}
      actions={<div className="flex items-center gap-4"><button onClick={() => navigate('/admin/hooks')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Hooks</button><button onClick={() => navigate('/')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Back to site</button></div>}
    />

    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-400">Admin</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Creators</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Upload a creator image to Cloudinary, save the secure URL, and use it in the spokesperson picker.</p>
        </div>
        <button onClick={reset} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
          <Plus className="h-4 w-4" /> New creator
        </button>
      </div>

      {(error || status) && <div role="status" className={`mt-6 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/50 text-red-200' : 'border-emerald-500/20 bg-emerald-950/30 text-emerald-200'}`}>{error || status}</div>}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4 px-1 pb-4">
            <h2 className="text-xl font-bold">Saved creators</h2>
            <span className="text-sm text-zinc-500">{creators.length} total</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {creators.map(creator => {
              const isSelected = selectedCreator?.id === creator.id;
              return <button
                key={creator.id}
                onClick={() => setSelectedCreatorId(creator.id)}
                className={`overflow-hidden rounded-2xl border text-left transition-colors ${isSelected ? 'border-purple-500 bg-purple-500/5' : 'border-white/10 bg-black/40 hover:border-white/20'}`}
              >
                <div className="aspect-[4/3] bg-zinc-900">
                  {creator.imageUrl ? <img src={creator.imageUrl} alt={creator.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-zinc-500"><ImageIcon className="h-10 w-10" /></div>}
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{creator.name}</h3>
                      {isSelected && <Check className="h-4 w-4 text-purple-400" />}
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-zinc-500">{creator.description ?? 'No description set'}</p>
                  </div>
                </div>
              </button>;
            })}
            {creators.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-zinc-500">No creators yet.</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Editor</p>
              <h2 className="mt-2 text-2xl font-bold">{selectedCreator ? 'Edit creator' : 'Create creator'}</h2>
            </div>
            {selectedCreator && <button onClick={deleteCreator} disabled={busy || uploading} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Name</span>
              <input
                value={form.name}
                onChange={event => updateForm('name', event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none ring-0 placeholder:text-zinc-600 focus:border-white/20"
                placeholder="Maya Brooks"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Description</span>
              <textarea
                value={form.description}
                onChange={event => updateForm('description', event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                placeholder="A versatile digital creator with a warm personality..."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Upload image</span>
                <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm transition-colors ${uploading ? 'border-blue-500/40 bg-blue-500/5 text-blue-300' : 'border-white/15 bg-black/30 text-zinc-300 hover:border-white/25'}`}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{uploading ? 'Uploading…' : 'Choose file'}</span>
                  <input type="file" accept="image/*" onChange={uploadImage} className="hidden" />
                </label>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Image URL</span>
                <input
                  value={form.imageUrl}
                  onChange={event => updateForm('imageUrl', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                  placeholder="https://res.cloudinary.com/..."
                />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-zinc-300">Preview</p>
                {form.imageUrl && <button onClick={() => updateForm('imageUrl', '')} className="text-sm text-zinc-500 hover:text-white">Clear image</button>}
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                {form.imageUrl ? <img src={form.imageUrl} alt={form.name || 'Creator preview'} className="aspect-[16/10] w-full object-cover" /> : <div className="grid aspect-[16/10] place-items-center text-zinc-500"><ImageIcon className="h-10 w-10" /></div>}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={saveCreator} disabled={busy || uploading || !form.name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
                <Save className="h-4 w-4" /> {selectedCreator ? 'Save changes' : 'Create creator'}
              </button>
              <button onClick={reset} disabled={busy || uploading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50">
                <X className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
