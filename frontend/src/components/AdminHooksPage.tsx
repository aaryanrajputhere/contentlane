import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Plus, Save, Trash2, X } from 'lucide-react';
import { Header } from './Header';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { HookTemplate, ScriptHookSceneBrief } from '../types/domain';

type HookTemplateForm = {
  title: string;
  text: string;
  templateType: string;
  sceneDurationSeconds: number;
  sortOrder: number;
  isActive: boolean;
  scenes: ScriptHookSceneBrief[];
};

const emptyScene: ScriptHookSceneBrief = {
  purpose: '',
  context: '',
  requiredVisualChange: '',
  overlayTextDirection: '',
};

const emptyForm: HookTemplateForm = {
  title: '',
  text: '',
  templateType: '',
  sceneDurationSeconds: 2,
  sortOrder: 0,
  isActive: true,
  scenes: [{ ...emptyScene }],
};

const templateToForm = (template: HookTemplate): HookTemplateForm => ({
  title: template.title,
  text: template.text,
  templateType: template.templateType,
  sceneDurationSeconds: template.sceneDurationSeconds,
  sortOrder: template.sortOrder,
  isActive: template.isActive,
  scenes: template.scenes.map(scene => ({ ...scene })),
});

const formToPayload = (form: HookTemplateForm): HookTemplateForm => ({
  title: form.title.trim(),
  text: form.text.trim(),
  templateType: form.templateType.trim(),
  sceneDurationSeconds: Number(form.sceneDurationSeconds),
  sortOrder: Number(form.sortOrder),
  isActive: form.isActive,
  scenes: form.scenes.map(scene => ({
    purpose: scene.purpose.trim(),
    context: scene.context.trim(),
    requiredVisualChange: scene.requiredVisualChange.trim(),
    overlayTextDirection: scene.overlayTextDirection.trim(),
  })),
});

export default function AdminHooksPage() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [templates, setTemplates] = useState<HookTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState<HookTemplateForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const selectedTemplate = useMemo(() => templates.find(template => template.id === selectedTemplateId) ?? null, [templates, selectedTemplateId]);

  const load = async () => {
    const data = await api<HookTemplate[]>('/hook-templates?includeInactive=true');
    setTemplates(data);
  };

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'ADMIN') return;
    void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load hook templates'));
  }, [loading, user]);

  useEffect(() => {
    setForm(selectedTemplate ? templateToForm(selectedTemplate) : emptyForm);
  }, [selectedTemplate]);

  if (loading) return <div className="min-h-screen bg-[#050505] text-white" />;
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />;

  const reset = () => {
    setSelectedTemplateId(null);
    setForm(emptyForm);
    setError('');
    setStatus('');
  };

  const updateForm = <K extends keyof HookTemplateForm>(key: K, value: HookTemplateForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const updateScene = <K extends keyof ScriptHookSceneBrief>(index: number, key: K, value: ScriptHookSceneBrief[K]) => {
    setForm(current => ({
      ...current,
      scenes: current.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, [key]: value } : scene),
    }));
  };

  const addScene = () => setForm(current => ({ ...current, scenes: [...current.scenes, { ...emptyScene }] }));

  const removeScene = (index: number) => setForm(current => ({ ...current, scenes: current.scenes.filter((_, sceneIndex) => sceneIndex !== index) }));

  const saveTemplate = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const payload = formToPayload(form);
      if (!payload.title || !payload.text || !payload.templateType) throw new Error('Title, hook text, and template type are required');
      if (payload.scenes.length === 0) throw new Error('At least one scene brief is required');
      if (selectedTemplate) {
        const updated = await api<HookTemplate>('/hook-templates/' + selectedTemplate.id, { method: 'PUT', body: JSON.stringify(payload) });
        setStatus('Hook template updated');
        setSelectedTemplateId(updated.id);
      } else {
        const created = await api<HookTemplate>('/hook-templates', { method: 'POST', body: JSON.stringify(payload) });
        setStatus('Hook template created');
        setSelectedTemplateId(created.id);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save hook template');
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (!window.confirm('Delete ' + selectedTemplate.title + '?')) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await api<void>('/hook-templates/' + selectedTemplate.id, { method: 'DELETE' });
      setStatus('Hook template deleted');
      await load();
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete hook template');
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-h-screen bg-[#050505] text-white">
    <Header
      type="landing"
      user={user}
      onGoToLanding={() => navigate('/')}
      onLogout={() => void logout()}
      actions={<div className="flex items-center gap-4"><button onClick={() => navigate('/admin/creators')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Creators</button><button onClick={() => navigate('/')} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Back to site</button></div>}
    />

    <main className="mx-auto max-w-7xl px-6 py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-400">Admin</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Hooks</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Manage the strategy templates shown in campaign creation.</p>
        </div>
        <button onClick={reset} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
          <Plus className="h-4 w-4" /> New template
        </button>
      </div>

      {(error || status) && <div role="status" className={`mt-6 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-950/50 text-red-200' : 'border-emerald-500/20 bg-emerald-950/30 text-emerald-200'}`}>{error || status}</div>}

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4 px-1 pb-4">
            <h2 className="text-xl font-bold">Templates</h2>
            <span className="text-sm text-zinc-500">{templates.length} total</span>
          </div>
          <div className="space-y-3">
            {templates.map(template => {
              const isSelected = selectedTemplate?.id === template.id;
              return <button key={template.id} onClick={() => setSelectedTemplateId(template.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${isSelected ? 'border-purple-500 bg-purple-500/5' : 'border-white/10 bg-black/40 hover:border-white/20'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{template.title}</h3>
                      {isSelected && <Check className="h-4 w-4 text-purple-400" />}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{template.text}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${template.isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>{template.isActive ? 'Active' : 'Off'}</span>
                </div>
                <div className="mt-3 text-xs text-zinc-600">Order {template.sortOrder} / {template.scenes.length} scenes</div>
              </button>;
            })}
            {templates.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-zinc-500">No hook templates yet.</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Editor</p>
              <h2 className="mt-2 text-2xl font-bold">{selectedTemplate ? 'Edit template' : 'Create template'}</h2>
            </div>
            {selectedTemplate && <button onClick={deleteTemplate} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-300">Title</span><input value={form.title} onChange={event => updateForm('title', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-white/20" placeholder="Mess vs. Masterpiece" /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-300">Template type</span><input value={form.templateType} onChange={event => updateForm('templateType', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-white/20" placeholder="Mess vs. Masterpiece" /></label>
            <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-zinc-300">Hook text</span><textarea value={form.text} onChange={event => updateForm('text', event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-white/20" placeholder="The difference becomes obvious in seconds" /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-300">Scene duration seconds</span><input type="number" min={1} max={30} value={form.sceneDurationSeconds} onChange={event => updateForm('sceneDurationSeconds', Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-white/20" /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-300">Sort order</span><input type="number" value={form.sortOrder} onChange={event => updateForm('sortOrder', Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-white/20" /></label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-medium text-zinc-300"><input type="checkbox" checked={form.isActive} onChange={event => updateForm('isActive', event.target.checked)} className="h-4 w-4 accent-purple-500" /> Active in campaign strategy picker</label>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold">Scene briefs</h3>
            <button onClick={addScene} disabled={form.scenes.length >= 20} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"><Plus className="h-4 w-4" /> Add scene</button>
          </div>

          <div className="mt-4 space-y-4">
            {form.scenes.map((scene, index) => <div key={index} className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="mb-4 flex items-center justify-between gap-4"><h4 className="font-semibold text-zinc-200">Scene {index + 1}</h4><button onClick={() => removeScene(index)} disabled={form.scenes.length <= 1} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-40"><X className="h-3 w-3" /> Remove</button></div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">Purpose</span><textarea value={scene.purpose} onChange={event => updateScene(index, 'purpose', event.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/20" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">Overlay text direction</span><textarea value={scene.overlayTextDirection} onChange={event => updateScene(index, 'overlayTextDirection', event.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/20" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">Context</span><textarea value={scene.context} onChange={event => updateScene(index, 'context', event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/20" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">Required visual change</span><textarea value={scene.requiredVisualChange} onChange={event => updateScene(index, 'requiredVisualChange', event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/20" /></label>
              </div>
            </div>)}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={saveTemplate} disabled={busy || !form.title.trim() || !form.text.trim() || !form.templateType.trim()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"><Save className="h-4 w-4" /> {selectedTemplate ? 'Save changes' : 'Create template'}</button>
            <button onClick={reset} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"><X className="h-4 w-4" /> Reset</button>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
