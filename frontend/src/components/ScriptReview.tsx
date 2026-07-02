import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Clapperboard, Trash } from 'lucide-react';
import { Header } from './Header';
import { api, post, waitForJob } from '../lib/api';
import type { QuotaItem, Script } from '../types/domain';

export default function ScriptReview() {
  const { id = '' } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate(); const productId = params.get('productId') ?? undefined;
  const [scripts, setScripts] = useState<Script[]>([]); const [selectedId, setSelectedId] = useState(params.get('scriptId')); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [mediaRemaining, setMediaRemaining] = useState(0);
  const load = async () => {
    setError('');
    const [scriptsResult, quotaResult] = await Promise.allSettled([
      api<Script[]>(`/campaigns/${id}/scripts${productId ? `?productId=${productId}` : ''}`),
      api<{ quota: Record<string, QuotaItem> }>('/quota'),
    ]);
    if (scriptsResult.status === 'rejected') {
      throw scriptsResult.reason;
    }
    setScripts(scriptsResult.value);
    if (!selectedId && scriptsResult.value[0]) setSelectedId(scriptsResult.value[0].id);
    if (quotaResult.status === 'fulfilled') {
      setMediaRemaining(quotaResult.value.quota.media_scene?.remaining ?? 0);
      return;
    }
    setMediaRemaining(0);
    const quotaError = quotaResult.reason instanceof Error ? quotaResult.reason.message : 'Unable to load quota';
    setError(`Scripts loaded, but quota is unavailable: ${quotaError}`);
  };
  // load intentionally refreshes scripts and quota when the route selection changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load scripts')); }, [id, productId]);
  const selected = useMemo(() => scripts.find(script => script.id === selectedId), [scripts, selectedId]); const hasImages = selected?.scenes.every(scene => scene.generatedImageUrl); const hasVideos = selected?.scenes.every(scene => scene.generatedVideoUrl);
  const generateMedia = async (kind: 'images' | 'videos') => { if (!selected) return; setBusy(true); setError(''); try { const { job } = await post<{ job: { id: string } }>(`/scripts/${selected.id}/${kind}/jobs`, { idempotencyKey: crypto.randomUUID() }); await waitForJob(job.id, (_progress, status) => setMessage(status ?? `Generating ${kind}`)); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : `Unable to generate ${kind}`); } finally { setBusy(false); } };
  const remove = async (scriptId: string) => { try { await api(`/scripts/${scriptId}`, { method: 'DELETE' }); setScripts(current => current.filter(script => script.id !== scriptId)); if (selectedId === scriptId) setSelectedId(null); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Delete failed'); } };
  return <div className="min-h-screen bg-[#050505] text-white pb-32"><Header type="landing" onGoToLanding={() => navigate('/')} /><main className="max-w-5xl mx-auto px-6 py-16"><h1 className="text-5xl font-bold text-center">Select the best script</h1>{error && <p role="alert" className="text-red-400 text-center mt-5">{error}</p>}<div className="space-y-6 mt-12">{scripts.map(script => <article key={script.id} className={`relative p-7 rounded-3xl border ${selectedId === script.id ? 'border-blue-500' : 'border-zinc-800'}`}><button className="w-full text-left" onClick={() => setSelectedId(script.id)}><div className="flex justify-between"><h2 className="text-xl font-bold">{script.hook}</h2>{selectedId === script.id && <Check />}</div><div className="space-y-3 mt-6">{script.scenes.map((scene, index) => <div key={`${script.id}-${index}`} className="bg-black/40 p-4 rounded-xl"><span className="text-xs text-zinc-500">Scene {index + 1} · {scene.durationSeconds}s</span><div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide"><span className={`rounded-full border px-2 py-1 ${scene.featuresCharacter ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>Character ref: {scene.featuresCharacter ? 'On' : 'Off'}</span><span className={`rounded-full border px-2 py-1 ${scene.featuresProduct ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>Product ref: {scene.featuresProduct ? 'On' : 'Off'}</span></div><p className="font-bold mt-3">{scene.onScreenText}</p><p className="text-sm text-purple-300 mt-2">{scene.imagePrompt}</p>{scene.generatedVideoUrl ? <video src={scene.generatedVideoUrl} controls className="mt-3 max-w-xs rounded-lg" /> : scene.generatedImageUrl ? <img src={scene.generatedImageUrl} alt="Generated scene" className="mt-3 max-w-xs rounded-lg" /> : null}{scene.error && <p className="text-red-400 text-sm mt-2">{scene.error}</p>}</div>)}</div></button><button aria-label="Delete script" onClick={() => void remove(script.id)} className="absolute top-4 right-14 p-2 text-red-400"><Trash size={18} /></button></article>)}</div></main><footer className="fixed bottom-0 inset-x-0 bg-black/90 border-t border-zinc-800 p-5"><div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-3"><span className="text-sm text-zinc-400">{mediaRemaining} media scenes remaining</span><div className="flex flex-wrap gap-3">{selected && !hasImages && <button disabled={busy || mediaRemaining < selected.scenes.length} onClick={() => void generateMedia('images')} className="bg-white text-black px-6 py-3 rounded-xl font-bold disabled:opacity-40">Generate images</button>}{selected && hasImages && !hasVideos && <button disabled={busy || mediaRemaining < selected.scenes.length} onClick={() => void generateMedia('videos')} className="bg-blue-500 text-black px-6 py-3 rounded-xl font-bold disabled:opacity-40">Generate videos</button>}{selected && hasVideos && <button onClick={() => navigate(`/editor/${selected.id}`)} className="bg-green-500 text-black px-6 py-3 rounded-xl font-bold flex gap-2">Open editor <Clapperboard /></button>}</div><span role="status" className="text-sm">{busy ? message || 'Working…' : ''}</span></div></footer></div>;
}
