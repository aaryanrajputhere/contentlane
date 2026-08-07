import { CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Inbox, Loader2, RotateCcw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SupportListResponse, SupportRequest, SupportStatus } from '../types/domain';
import AdminHeader from './AdminHeader';

const filters: Array<{ label: string; value: SupportStatus | '' }> = [{ label: 'All', value: '' }, { label: 'New', value: 'NEW' }, { label: 'Open', value: 'OPEN' }, { label: 'Resolved', value: 'RESOLVED' }];
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AdminSupportPage() {
  const [data, setData] = useState<SupportListResponse | null>(null);
  const [selected, setSelected] = useState<SupportRequest | null>(null);
  const [status, setStatus] = useState<SupportStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      const result = await api<SupportListResponse>(`/admin/support?${params}`);
      setData(result);
      setSelected((current) => result.requests.find((item) => item.id === current?.id) ?? result.requests[0] ?? null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load support requests.'); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 250);
    const refreshTimer = window.setInterval(() => void load(), 15_000);
    const refreshOnFocus = () => void load();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [load]);

  const updateStatus = async (nextStatus: 'OPEN' | 'RESOLVED') => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ request: SupportRequest }>(`/admin/support/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      setSelected(result.request); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update this request.'); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111]">
      <AdminHeader newCount={data?.counts.NEW ?? 0} />
      <div className="mx-auto max-w-[1500px] p-3 sm:p-6">
        <div className="overflow-hidden rounded-[24px] border border-[#e4e4e4] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
          <div className="grid min-h-[calc(100vh-7rem)] lg:grid-cols-[410px_1fr]">
            <aside className={`border-[#e8e8e8] lg:border-r ${selected ? 'hidden lg:block' : 'block'}`}>
              <div className="border-b border-[#e8e8e8] p-4">
                <div className="relative"><Search size={16} className="absolute left-3.5 top-3.5 text-[#999]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search email or message" className="w-full rounded-xl border border-[#ddd] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#111]" /></div>
                <div className="mt-3 flex gap-1 overflow-x-auto">{filters.map((filter) => <button key={filter.label} onClick={() => { setStatus(filter.value); setPage(1); }} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${status === filter.value ? 'bg-[#111] text-white' : 'bg-[#f3f3f3] text-[#666]'}`}>{filter.label}{filter.value ? ` ${data?.counts[filter.value] ?? 0}` : ''}</button>)}</div>
                {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</p> : null}
              </div>
              {loading ? <div className="grid h-48 place-items-center"><Loader2 className="animate-spin text-[#888]" /></div> : data?.requests.length ? <div className="divide-y divide-[#ededed]">{data.requests.map((item) => <button key={item.id} onClick={() => setSelected(item)} className={`block w-full p-4 text-left transition hover:bg-[#fafafa] ${selected?.id === item.id ? 'bg-[#f5f5f5]' : ''}`}><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{item.user?.name || item.email}</span><span className="shrink-0 text-[10px] text-[#999]">{date(item.createdAt).split(',')[0]}</span></div><p className="mt-1 truncate text-xs text-[#777]">{item.email}</p><p className="mt-2 line-clamp-2 text-sm leading-5 text-[#555]">{item.message}</p><span className={`mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] ${item.status === 'NEW' ? 'text-blue-600' : 'text-[#888]'}`}><CircleDot size={10} />{item.status}</span></button>)}</div> : <div className="px-8 py-20 text-center"><Inbox className="mx-auto text-[#bbb]" /><p className="mt-4 font-semibold">No requests here</p><p className="mt-1 text-sm text-[#888]">Try another filter or search.</p></div>}
              {data && data.pagination.totalPages > 1 ? <div className="flex items-center justify-between border-t border-[#eee] p-3 text-xs text-[#777]"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg p-2 disabled:opacity-30"><ChevronLeft size={16} /></button><span>{page} of {data.pagination.totalPages}</span><button disabled={page === data.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg p-2 disabled:opacity-30"><ChevronRight size={16} /></button></div> : null}
            </aside>
            <section className={`${selected ? 'block' : 'hidden lg:grid'} min-w-0 lg:place-items-center`}>
              {selected ? <div className="mx-auto max-w-3xl p-5 sm:p-10 lg:p-14"><button onClick={() => setSelected(null)} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-[#777] lg:hidden"><ChevronLeft size={16} />Inbox</button><div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#e8e8e8] pb-8"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999]">{selected.status} request</p><h1 className="mt-3 break-all text-2xl font-bold tracking-[-0.04em] sm:text-3xl">{selected.user?.name || selected.email}</h1><a href={`mailto:${selected.email}`} className="mt-2 block text-sm text-[#666] underline-offset-4 hover:underline">{selected.email}</a></div><button disabled={busy} onClick={() => void updateStatus(selected.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED')} className="inline-flex items-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : selected.status === 'RESOLVED' ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}{selected.status === 'RESOLVED' ? 'Reopen' : 'Resolve'}</button></div><div className="py-10"><p className="whitespace-pre-wrap text-[17px] leading-8 text-[#333]">{selected.message}</p></div><dl className="grid gap-5 border-t border-[#e8e8e8] pt-7 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wider text-[#999]">Received</dt><dd className="mt-1.5">{date(selected.createdAt)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-[#999]">Last updated</dt><dd className="mt-1.5">{date(selected.updatedAt)}</dd></div>{selected.resolvedAt ? <div><dt className="text-xs font-semibold uppercase tracking-wider text-[#999]">Resolved</dt><dd className="mt-1.5">{date(selected.resolvedAt)}</dd></div> : null}</dl>{error ? <p role="alert" className="mt-6 text-sm text-red-700">{error}</p> : null}</div> : <div className="text-center text-[#999]"><Inbox className="mx-auto" /><p className="mt-3 text-sm">Select a request to read it</p></div>}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
