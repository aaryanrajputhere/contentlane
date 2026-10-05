import { useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { brandDemoName } from '../lib/brandDemos';
import type { MediaAsset, ProjectSnapshot } from '../types/domain';

const MAX_DEMOS = 10;

export default function BrandDemoLibrary({
  projectId,
  demos,
  defaultDemoAssetId,
  brandDemoCaptionsEnabled = true,
  onProjectChange,
  tone = 'light',
  layout = 'shelf',
}: {
  projectId: string;
  demos: MediaAsset[];
  defaultDemoAssetId: string | null;
  brandDemoCaptionsEnabled?: boolean;
  onProjectChange: (project: ProjectSnapshot) => void;
  tone?: 'light' | 'dark';
  layout?: 'shelf' | 'grid';
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const dark = tone === 'dark';

  const saveCaptionSetting = async () => {
    if (busy) return;
    setBusy('captions'); setError('');
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        api<{ project: ProjectSnapshot }>(`/projects/${projectId}/demo-caption-settings`, {
          method: 'PATCH', signal: controller.signal,
          body: JSON.stringify({ brandDemoCaptionsEnabled: !brandDemoCaptionsEnabled }),
        }),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(new ApiClientError('REQUEST_TIMEOUT', 'Saving took too long. Please try again.'));
            controller.abort();
          }, 15000);
        }),
      ]);
      onProjectChange(response.project);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Unable to save demo caption settings.');
    } finally {
      clearTimeout(timeoutId);
      setBusy('');
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const selected = Array.from(files).slice(0, Math.max(0, MAX_DEMOS - demos.length));
    if (!selected.length) return;
    setBusy('upload'); setError('');
    const body = new FormData();
    selected.forEach((file) => body.append('demos', file));
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${projectId}/brand-demos`, { method: 'POST', body });
      onProjectChange(response.project);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Unable to upload product demos.');
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const saveName = async (demo: MediaAsset) => {
    const cleanName = name.trim();
    if (!cleanName || busy) return;
    setBusy(`rename:${demo.id}`); setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${projectId}/brand-demos/${demo.id}`, { method: 'PATCH', body: JSON.stringify({ name: cleanName }) });
      onProjectChange(response.project); setRenamingId(null);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to rename this demo.'); }
    finally { setBusy(''); }
  };

  const makeDefault = async (demo: MediaAsset) => {
    if (busy || demo.id === defaultDemoAssetId) return;
    setBusy(`default:${demo.id}`); setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${projectId}/brand-demos/${demo.id}/default`, { method: 'PUT' });
      onProjectChange(response.project);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to change the default demo.'); }
    finally { setBusy(''); }
  };

  const remove = async (demo: MediaAsset) => {
    if (busy || !window.confirm(`Delete “${brandDemoName(demo)}”? Hooks using it will fall back to the project default.`)) return;
    setBusy(`delete:${demo.id}`); setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${projectId}/brand-demos/${demo.id}`, { method: 'DELETE' });
      onProjectChange(response.project);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to delete this demo.'); }
    finally { setBusy(''); }
  };

  return <div className={`min-w-0 w-full ${dark ? 'text-white' : 'text-[#111]'}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className={`text-[10px] font-bold uppercase tracking-[.18em] ${dark ? 'text-[#b8f36b]' : 'text-[#15803d]'}`}>Product demo library</p><h3 className="mt-1 text-xl font-black tracking-[-.04em]">Your product, ready for every hook.</h3><p className={`mt-1 text-xs leading-5 ${dark ? 'text-white/55' : 'text-[#777]'}`}>The default is used automatically unless a hook chooses another demo.</p></div>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy) || demos.length >= MAX_DEMOS} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${dark ? 'bg-white text-[#111] hover:bg-[#efefeb]' : 'bg-[#111] text-white hover:bg-[#2a2a2a]'}`}>{busy === 'upload' ? <Loader2 size={15} className="animate-spin" /> : demos.length ? <Plus size={15} /> : <Upload size={15} />}{busy === 'upload' ? 'Uploading…' : demos.length ? 'Add demos' : 'Upload demos'}</button>
      <input ref={inputRef} type="file" multiple accept="video/*" className="hidden" onChange={(event) => void upload(event.target.files)} />
    </div>
    <div className={`mt-4 flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${dark ? 'border-white/15 bg-[#1c1c1c] text-white' : 'border-black/10 bg-[#fafafa] text-[#111]'}`}>
      <div className="min-w-0 flex-1 basis-44">
        <p id={`demo-caption-label-${projectId}`} className={`text-sm font-bold ${dark ? 'text-white' : 'text-[#111]'}`}>Show brand demo captions</p>
        <p className={`mt-1 text-xs leading-5 ${dark ? 'text-white/65' : 'text-[#666]'}`}>Use this setting for all hooks, or change it for an individual video.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span role="status" aria-live="polite" className={`min-w-14 text-right text-xs font-semibold ${dark ? 'text-white/70' : 'text-[#555]'}`}>
          {busy === 'captions' ? 'Saving…' : brandDemoCaptionsEnabled ? 'On' : 'Off'}
        </span>
        <button type="button" role="switch" aria-checked={brandDemoCaptionsEnabled} aria-labelledby={`demo-caption-label-${projectId}`} aria-busy={busy === 'captions'} disabled={Boolean(busy)} onClick={() => void saveCaptionSetting()} className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50 ${brandDemoCaptionsEnabled ? 'bg-[#15803d]' : 'bg-[#777]'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${brandDemoCaptionsEnabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
    </div>
    {error ? <p role="alert" className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${dark ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-700'}`}>{error}</p> : null}
    <div className={layout === 'grid' ? 'mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : `mt-4 flex gap-3 overflow-x-auto pb-2 ${demos.length ? '' : 'overflow-hidden'}`}>
      {demos.map((demo) => {
        const isDefault = demo.id === defaultDemoAssetId;
        const isBusy = busy.endsWith(demo.id);
        return <article key={demo.id} className={`${layout === 'grid' ? 'w-full' : 'w-[156px] shrink-0'} overflow-hidden rounded-[18px] border p-1.5 transition ${isDefault ? dark ? 'border-[#b8f36b]/70 bg-[#b8f36b]/10' : 'border-[#15803d]/45 bg-[#f2faed]' : dark ? 'border-white/12 bg-white/5' : 'border-black/8 bg-white'}`}>
          <div className={`relative overflow-hidden rounded-[13px] bg-[#111] ${layout === 'grid' ? 'aspect-[9/16]' : 'aspect-[9/13]'}`}><video src={demo.url} className={`h-full w-full ${layout === 'grid' ? 'object-contain' : 'object-cover'}`} muted playsInline preload="metadata" controls={layout === 'grid'} />{isDefault ? <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#15803d] px-2 py-1 text-[9px] font-black uppercase tracking-[.1em] text-white shadow"><Star size={10} fill="currentColor" />Default</span> : null}{isBusy ? <span className="absolute inset-0 grid place-items-center bg-black/45"><Loader2 size={20} className="animate-spin text-white" /></span> : null}</div>
          <div className="px-1 pb-1 pt-2">{renamingId === demo.id ? <div className="flex items-center gap-1"><input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveName(demo); if (event.key === 'Escape') setRenamingId(null); }} className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-[10px] font-bold outline-none ${dark ? 'border-white/20 bg-black/30 text-white' : 'border-black/15 bg-white'}`} /><button type="button" aria-label="Save name" onClick={() => void saveName(demo)} className="text-[#15803d]"><Check size={13} /></button><button type="button" aria-label="Cancel rename" onClick={() => setRenamingId(null)} className={dark ? 'text-white/60' : 'text-[#888]'}><X size={13} /></button></div> : <p className="truncate text-[11px] font-black">{brandDemoName(demo)}</p>}
            <div className={`mt-2 flex items-center justify-between ${dark ? 'text-white/55' : 'text-[#777]'}`}><button type="button" onClick={() => { setRenamingId(demo.id); setName(brandDemoName(demo)); }} aria-label={`Rename ${brandDemoName(demo)}`} className="rounded-md p-1 hover:bg-black/5"><Pencil size={12} /></button><button type="button" onClick={() => void makeDefault(demo)} disabled={isDefault} aria-label={`Make ${brandDemoName(demo)} default`} className="rounded-md p-1 hover:bg-black/5 disabled:opacity-25"><Star size={12} /></button><button type="button" onClick={() => void remove(demo)} aria-label={`Delete ${brandDemoName(demo)}`} className="rounded-md p-1 text-red-500 hover:bg-red-500/10"><Trash2 size={12} /></button></div>
          </div>
        </article>;
      })}
      {!demos.length ? <button type="button" onClick={() => inputRef.current?.click()} className={`grid min-h-52 w-full place-items-center rounded-[20px] border border-dashed px-6 text-center ${layout === 'grid' ? 'sm:col-span-2 md:col-span-3 xl:col-span-4' : ''} ${dark ? 'border-white/15 bg-white/[.03] text-white/55' : 'border-black/15 bg-white text-[#777]'}`}><span><Upload size={24} className="mx-auto mb-2 opacity-55" /><span className="block text-sm font-bold">Add your first product demo</span><span className="mt-1 block text-xs">Select up to {MAX_DEMOS} vertical or screen-recorded videos.</span></span></button> : null}
    </div>
    <div className={`mt-2 flex items-center justify-between text-[10px] font-semibold ${dark ? 'text-white/40' : 'text-[#999]'}`}><span>{demos.length} of {MAX_DEMOS} demos</span>{demos.length ? <span>50 MB max per file</span> : null}</div>
  </div>;
}
