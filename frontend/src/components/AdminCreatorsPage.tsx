import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CirclePlus,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { CreatorClipRecord, CreatorRecord } from '../types/domain';

type CreatorTab = 'clips' | 'details' | 'usage';
type ClipTypeFilter = 'all' | 'image' | 'video';
type ClipSortOrder = 'newest' | 'oldest';
type ClipModalMode = 'create' | 'edit';

function toTagList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/g)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function joinTags(tags: string[]) {
  return tags.join(', ');
}

function formatUpdatedAt(value: string) {
  const updatedAt = new Date(value);
  const now = new Date();
  const diffInMs = now.getTime() - updatedAt.getTime();
  const diffInDays = Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));
  if (diffInDays <= 0) return 'Updated today';
  if (diffInDays === 1) return 'Updated 1 day ago';
  if (diffInDays < 7) return `Updated ${diffInDays} days ago`;
  return `Updated ${updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function creatorMeta(creator: CreatorRecord) {
  const tags = creator.character.clipTags ?? [];
  return tags.slice(0, 3).join(', ') || 'Lifestyle, Wellness, Tech';
}

const shellClass = 'rounded-[26px] border border-[#ECECEC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]';
const pageShellClass = 'mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12';
const inputClass =
  'w-full rounded-[18px] border border-[#ECECEC] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#9A9A9A] focus:border-black focus:ring-1 focus:ring-black/10';
const textareaClass =
  'w-full rounded-[18px] border border-[#ECECEC] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#9A9A9A] focus:border-black focus:ring-1 focus:ring-black/10';
const labelClass = 'mb-2 block text-[12px] uppercase tracking-[0.18em] text-[#666666]';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-50';
const subtleButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50';
const iconButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[#ECECEC] bg-white px-3 py-2 text-sm font-medium text-[#666666] transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-50';

function CreatorListItem({
  creator,
  active,
  onSelect,
}: {
  creator: CreatorRecord;
  active: boolean;
  onSelect: (creatorId: string) => void;
}) {
  const statusClass = creator.clipCount > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F3F4F6] text-[#666666]';
  return (
    <button
      type="button"
      onClick={() => onSelect(creator.id)}
      className={`w-full rounded-[16px] border p-3 text-left transition ${active ? 'border-black bg-white shadow-[0_10px_24px_rgba(0,0,0,0.06)]' : 'border-transparent bg-white hover:border-[#D9D9D9]'}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#ECECEC] bg-[#F6F5F1]">
          <img src={creator.baseImageUrl} alt={creator.name} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">{creator.name}</p>
              <p className="mt-0.5 text-[12px] text-[#666666]">
                {creator.clipCount} clips · {formatUpdatedAt(creator.updatedAt)}
              </p>
            </div>
            <ChevronRight size={15} className="mt-1 text-[#9A9A9A]" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${statusClass}`}>{creator.clipCount > 0 ? 'Active' : 'Idle'}</span>
            <span className="truncate text-[12px] text-[#666666]">{creatorMeta(creator)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ClipCard({ clip, onOpen }: { clip: CreatorClipRecord; onOpen: (clip: CreatorClipRecord) => void }) {
  return (
    <button type="button" onClick={() => onOpen(clip)} className="group block text-left">
      <div className="relative aspect-[1/1.12] overflow-hidden rounded-[16px] border border-[#ECECEC] bg-[#F6F5F1]">
        {clip.mimeType?.startsWith('video/') ? (
          <video src={clip.url} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <img src={clip.url} alt={clip.title || 'Creator clip'} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 opacity-0 transition group-hover:bg-black/5 group-hover:opacity-100" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Pencil size={16} />
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1 px-1">
        <p className="truncate text-[12px] font-medium text-[#111111]">{clip.title || 'Untitled clip'}</p>
        <p className="truncate text-[11px] text-[#666666]">{clip.tags[0] ?? 'Clip'}</p>
      </div>
    </button>
  );
}

function ClipModal({
  mode,
  clip,
  creatorName,
  open,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  mode: ClipModalMode;
  clip: CreatorClipRecord | null;
  creatorName: string;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; tags: string[]; sortOrder: number; file: File | null }) => Promise<void>;
  onDelete?: (clipId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && clip) {
      setTitle(clip.title ?? '');
      setTags(joinTags(clip.tags));
      setSortOrder(String(clip.sortOrder));
      setFile(null);
      return;
    }
    setTitle('');
    setTags('');
    setSortOrder('0');
    setFile(null);
  }, [clip, mode, open]);

  if (!open || !clip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-[2px]">
      <div className={`${shellClass} w-full max-w-[40rem] overflow-hidden`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#ECECEC] px-6 py-4">
          <div>
            <p className={labelClass}>{mode === 'edit' ? 'Edit clip' : 'Upload clip'}</p>
            <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-[#111111]">{creatorName}</h3>
          </div>
          <button type="button" onClick={onClose} className={iconButtonClass}>
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-[0.92fr_1.08fr]">
          <div className="overflow-hidden rounded-[18px] border border-[#ECECEC] bg-[#F6F5F1]">
            {clip.mimeType?.startsWith('video/') ? (
              <video src={clip.url} className="h-full w-full object-cover" muted autoPlay loop playsInline />
            ) : (
              <img src={clip.url} alt={clip.title || 'Creator clip'} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Clip title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Optional clip title" />
            </label>
            <label className="block">
              <span className={labelClass}>Tags</span>
              <textarea value={tags} onChange={(event) => setTags(event.target.value)} className="min-h-[140px] w-full rounded-[18px] border border-[#ECECEC] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#9A9A9A] focus:border-black focus:ring-1 focus:ring-black/10" placeholder="Hook, founder, testimonial" />
            </label>
            <label className="block">
              <span className={labelClass}>Sort order</span>
              <input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} type="number" min="0" className={inputClass} />
            </label>
            {mode === 'create' ? (
              <label className="block">
                <span className={labelClass}>Clip file</span>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#D9D9D9] bg-white px-4 py-4 text-sm text-[#666666] transition hover:border-black hover:text-black">
                  <Upload size={16} />
                  <span className="truncate">{file ? file.name : 'Choose a clip'}</span>
                  <input type="file" accept="video/*,image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
              </label>
            ) : null}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'create' && !file) return;
                  const clipFile = mode === 'create' ? file : null;
                  void onSave({ title: title.trim(), tags: toTagList(tags), sortOrder: Number(sortOrder) || 0, file: clipFile });
                }}
                disabled={busy || (mode === 'create' && !file)}
                className={`${primaryButtonClass} flex-1`}
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {mode === 'edit' ? 'Save clip' : 'Upload clip'}
              </button>
              {mode === 'edit' && onDelete ? (
                <button type="button" onClick={() => void onDelete(clip.id)} disabled={busy} className={iconButtonClass}>
                  <Trash2 size={16} />
                </button>
              ) : (
                <button type="button" onClick={onClose} className={subtleButtonClass}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorModal({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; description: string; baseImage: File }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseImage, setBaseImage] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setBaseImage(null);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-[2px]">
      <div className={`${shellClass} w-full max-w-[34rem] overflow-hidden`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#ECECEC] px-6 py-4">
          <div>
            <p className={labelClass}>New creator</p>
            <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-[#111111]">Create creator</h3>
          </div>
          <button type="button" onClick={onClose} className={iconButtonClass}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Creator name" />
          </label>
          <label className="block">
            <span className={labelClass}>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClass} placeholder="Persona, tone, visual direction" />
          </label>
          <label className="block">
            <span className={labelClass}>Base image</span>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#D9D9D9] bg-white px-4 py-5 text-sm text-[#666666] transition hover:border-black hover:text-black">
              <Upload size={16} />
              <span className="truncate">{baseImage ? baseImage.name : 'Choose an image file'}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => setBaseImage(event.target.files?.[0] ?? null)} />
            </label>
          </label>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!baseImage || !name.trim()) return;
                void onCreate({ name: name.trim(), description: description.trim(), baseImage });
              }}
              disabled={busy || !baseImage || !name.trim()}
              className={`${primaryButtonClass} flex-1`}
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Create creator
            </button>
            <button type="button" onClick={onClose} className={subtleButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsPanel({
  creator,
  busy,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editSortOrder,
  setEditSortOrder,
  editBaseImage,
  setEditBaseImage,
  editBaseImagePreview,
  onSave,
  onDelete,
}: {
  creator: CreatorRecord;
  busy: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  editSortOrder: string;
  setEditSortOrder: (value: string) => void;
  editBaseImage: File | null;
  setEditBaseImage: (file: File | null) => void;
  editBaseImagePreview: string | null;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[24px] border border-[#ECECEC] bg-[#FAFAF8] p-5">
        <p className={labelClass}>Base image</p>
        <div className="mt-4 overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white">
          <img src={editBaseImagePreview ?? creator.baseImageUrl} alt={creator.name} className="h-[26rem] w-full object-cover" />
        </div>
        <label className="mt-4 block">
          <span className={labelClass}>Replace base image</span>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#D9D9D9] bg-white px-4 py-4 text-sm text-[#666666] transition hover:border-black hover:text-black">
            <ImageIcon size={16} />
            <span className="truncate">{editBaseImage ? editBaseImage.name : 'Upload a replacement image'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => setEditBaseImage(event.target.files?.[0] ?? null)} />
          </label>
        </label>
      </div>

      <div className="space-y-4 rounded-[24px] border border-[#ECECEC] bg-white p-5">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={editName} onChange={(event) => setEditName(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="min-h-[140px] w-full rounded-[18px] border border-[#ECECEC] bg-[#FAFAF8] px-4 py-3 text-sm text-[#111111] outline-none transition placeholder:text-[#9A9A9A] focus:border-black focus:ring-1 focus:ring-black/10" />
        </label>
        <label className="block">
          <span className={labelClass}>Sort order</span>
          <input value={editSortOrder} onChange={(event) => setEditSortOrder(event.target.value)} type="number" min="0" className={inputClass} />
        </label>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => void onSave()} disabled={busy} className={`${primaryButtonClass} flex-1`}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
            Save creator
          </button>
          <button type="button" onClick={() => void onDelete()} disabled={busy} className={subtleButtonClass}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showCreatorActions, setShowCreatorActions] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CreatorTab>('clips');
  const [createOpen, setCreateOpen] = useState(false);
  const [clipModal, setClipModal] = useState<{ mode: ClipModalMode; clip: CreatorClipRecord | null } | null>(null);
  const [clipTypeFilter, setClipTypeFilter] = useState<ClipTypeFilter>('all');
  const [clipSortOrder, setClipSortOrder] = useState<ClipSortOrder>('newest');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSortOrder, setEditSortOrder] = useState('0');
  const [editBaseImage, setEditBaseImage] = useState<File | null>(null);
  const [editBaseImagePreview, setEditBaseImagePreview] = useState<string | null>(null);

  const loadCreators = async () => {
    const response = await api<{ creators: CreatorRecord[] }>('/creators');
    setCreators(response.creators);
    setSelectedCreatorId((current) => {
      if (current && response.creators.some((creator) => creator.id === current)) {
        return current;
      }
      return response.creators[0]?.id ?? null;
    });
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    void loadCreators()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load creators'))
      .finally(() => setLoading(false));
  }, []);

  const activeCreator = useMemo(() => creators.find((creator) => creator.id === selectedCreatorId) ?? null, [creators, selectedCreatorId]);
  const creatorTags = useMemo(
    () => Array.from(new Set(creators.flatMap((creator) => creator.clips.flatMap((clip) => clip.tags)))).sort(),
    [creators],
  );

  useEffect(() => {
    setShowCreatorActions(false);
    if (!activeCreator) return;
    setEditName(activeCreator.name);
    setEditDescription(activeCreator.description ?? '');
    setEditSortOrder(String(activeCreator.sortOrder));
    setEditBaseImage(null);
    setEditBaseImagePreview(null);
  }, [activeCreator]);

  useEffect(() => {
    if (!editBaseImage) {
      setEditBaseImagePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(editBaseImage);
    setEditBaseImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editBaseImage]);

  const filteredCreators = useMemo(() => {
    const term = search.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();
    return creators.filter((creator) => {
      const matchesTerm =
        !term ||
        creator.name.toLowerCase().includes(term) ||
        (creator.description ?? '').toLowerCase().includes(term) ||
        creator.clips.some((clip) => clip.tags.some((item) => item.includes(term)));
      const matchesTag = !tag || creator.clips.some((clip) => clip.tags.includes(tag));
      return matchesTerm && matchesTag;
    });
  }, [creators, search, tagFilter]);

  const visibleClips = useMemo(() => {
    if (!activeCreator) return [];
    const filtered = activeCreator.clips.filter((clip) => {
      if (clipTypeFilter === 'image') return clip.mimeType?.startsWith('image/') ?? false;
      if (clipTypeFilter === 'video') return clip.mimeType?.startsWith('video/') ?? false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return clipSortOrder === 'newest' ? -diff : diff;
    });
  }, [activeCreator, clipSortOrder, clipTypeFilter]);

  const summaryTags = activeCreator
    ? Array.from(new Set((activeCreator.character.clipTags ?? []).concat(activeCreator.clips.flatMap((clip) => clip.tags)))).slice(0, 3)
    : [];

  const selectedClipCount = activeCreator?.clips.length ?? 0;

  const createCreator = async (payload: { name: string; description: string; baseImage: File }) => {
    if (busy) return;
    setBusy('Creating creator');
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', payload.name);
      formData.append('description', payload.description);
      formData.append('baseImage', payload.baseImage);
      formData.append('sortOrder', String(creators.length));
      const response = await api<{ creator: CreatorRecord }>('/creators', { method: 'POST', body: formData });
      setCreators((current) => [...current, response.creator].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)));
      setSelectedCreatorId(response.creator.id);
      setActiveTab('clips');
      setCreateOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create creator');
    } finally {
      setBusy(null);
    }
  };

  const saveCreator = async () => {
    if (!activeCreator || busy) return;
    setBusy('Saving creator');
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('description', editDescription.trim());
      formData.append('sortOrder', editSortOrder || '0');
      if (editBaseImage) formData.append('baseImage', editBaseImage);
      const response = await api<{ creator: CreatorRecord }>(`/creators/${activeCreator.id}`, { method: 'PATCH', body: formData });
      setCreators((current) => current.map((creator) => (creator.id === response.creator.id ? response.creator : creator)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save creator');
    } finally {
      setBusy(null);
    }
  };

  const deleteCreator = async () => {
    if (!activeCreator || busy) return;
    if (!window.confirm(`Delete ${activeCreator.name}?`)) return;
    setBusy('Deleting creator');
    setError('');
    try {
      await api<void>(`/creators/${activeCreator.id}`, { method: 'DELETE' });
      setCreators((current) => current.filter((creator) => creator.id !== activeCreator.id));
      setSelectedCreatorId((current) => {
        const remaining = creators.filter((creator) => creator.id !== activeCreator.id);
        return current === activeCreator.id ? remaining[0]?.id ?? null : current;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete creator');
    } finally {
      setBusy(null);
    }
  };

  const uploadClip = async (payload: { title: string; tags: string[]; sortOrder: number; file: File | null }) => {
    if (!activeCreator || busy || !payload.file) return;
    setBusy('Uploading clip');
    setError('');
    try {
      const formData = new FormData();
      formData.append('clip', payload.file);
      formData.append('title', payload.title);
      formData.append('tags', payload.tags.join(','));
      formData.append('sortOrder', String(payload.sortOrder));
      const response = await api<{ clip: CreatorClipRecord }>(`/creators/${activeCreator.id}/clips`, { method: 'POST', body: formData });
      setCreators((current) =>
        current.map((creator) =>
          creator.id === activeCreator.id
            ? {
                ...creator,
                clips: [...creator.clips, response.clip].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
                clipCount: creator.clipCount + 1,
                character: creator.character,
              }
            : creator,
        ),
      );
      setClipModal(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload clip');
    } finally {
      setBusy(null);
    }
  };

  const saveClip = async (clipId: string, tags: string[], title: string | null) => {
    if (busy) return;
    setBusy(`Saving clip ${clipId}`);
    setError('');
    try {
      const response = await api<{ clip: CreatorClipRecord }>(`/clips/${clipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags, title }),
      });
      setCreators((current) =>
        current.map((creator) => ({
          ...creator,
          clips: creator.clips.map((clip) => (clip.id === clipId ? response.clip : clip)),
          character: creator.character,
        })),
      );
      setClipModal(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save clip');
    } finally {
      setBusy(null);
    }
  };

  const deleteClip = async (clipId: string) => {
    if (busy) return;
    if (!window.confirm('Delete this clip?')) return;
    setBusy(`Deleting clip ${clipId}`);
    setError('');
    try {
      await api<void>(`/clips/${clipId}`, { method: 'DELETE' });
      setCreators((current) =>
        current.map((creator) => ({
          ...creator,
          clips: creator.clips.filter((clip) => clip.id !== clipId),
          clipCount: creator.clips.some((clip) => clip.id === clipId) ? creator.clipCount - 1 : creator.clipCount,
          character: creator.character,
        })),
      );
      setClipModal(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete clip');
    } finally {
      setBusy(null);
    }
  };


  return (
    <main className="min-h-screen bg-[#FAFAF8] text-[#111111]">
      <div className="border-b border-black/6 bg-white/95 backdrop-blur-xl">
        <div className={`${pageShellClass} flex items-center justify-between gap-4 py-4`}>
          <div className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</div>
          <nav className="hidden items-center gap-8 text-sm text-[#666666] lg:flex">
            <span>Dashboard</span>
            <span>Projects</span>
            <span className="rounded-full bg-black px-3 py-1.5 text-white">Creators</span>
            <span>Media</span>
            <span>Analytics</span>
            <span>Settings</span>
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
              <Plus size={16} />
              New Project
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#EFE7FF] text-sm font-semibold text-[#6B4AE2]">AR</div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-5 py-5 sm:px-8 lg:px-20">
        <aside className="w-full max-w-[270px] shrink-0 space-y-4">
          <div className="space-y-3 px-1">
            <p className="text-[24px] font-semibold tracking-[-0.04em] text-[#111111]">Creators</p>
            <p className="text-[12px] leading-5 text-[#666666]">Manage your AI UGC creators and their clips.</p>
          </div>

          <button type="button" onClick={() => setCreateOpen(true)} className={`${primaryButtonClass} w-full`}>
            <CirclePlus size={16} />
            Create new creator
          </button>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search creators..."
                  className="w-full rounded-full border border-[#ECECEC] bg-white py-3 pl-10 pr-4 text-sm text-[#111111] outline-none transition placeholder:text-[#9A9A9A] focus:border-black focus:ring-1 focus:ring-black/10"
                />
              </div>
              <button type="button" onClick={() => setShowTagPicker((current) => !current)} className={iconButtonClass} aria-label="Filter creators">
                <SlidersHorizontal size={16} />
              </button>
            </div>
            {showTagPicker ? (
              <div className="rounded-[18px] border border-[#ECECEC] bg-white p-3 shadow-[0_12px_24px_rgba(0,0,0,0.04)]">
                <button
                  type="button"
                  onClick={() => setTagFilter('')}
                  className={`mb-2 block w-full rounded-full px-3 py-2 text-left text-sm ${tagFilter ? 'text-[#666666]' : 'bg-black text-white'}`}
                >
                  All tags
                </button>
                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                  {creatorTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTagFilter(tag)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        tagFilter === tag ? 'border-black bg-black text-white' : 'border-[#ECECEC] bg-[#FAFAF8] text-[#666666] hover:border-black hover:text-black'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {filteredCreators.map((creator) => (
              <CreatorListItem
                key={creator.id}
                creator={creator}
                active={creator.id === selectedCreatorId}
                onSelect={(creatorId) => {
                  setSelectedCreatorId(creatorId);
                  setActiveTab('clips');
                }}
              />
            ))}
            {!filteredCreators.length && !loading ? (
              <div className="rounded-[18px] border border-dashed border-[#ECECEC] bg-white p-4 text-sm text-[#666666]">No creators match the current filters.</div>
            ) : null}
            {loading ? (
              <div className="rounded-[18px] border border-dashed border-[#ECECEC] bg-white p-4 text-sm text-[#666666]">Loading creators…</div>
            ) : null}
          </div>

          <button type="button" className="flex w-full items-center justify-center gap-2 rounded-full border border-[#ECECEC] bg-white px-4 py-3 text-sm text-[#111111] hover:border-black">
            <ImageIcon size={15} />
            View archived creators
          </button>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <div className={`${shellClass} px-5 py-5 sm:px-6 sm:py-6`}>
            {activeCreator ? (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[24px] border border-[#ECECEC] bg-[#F6F5F1] sm:h-28 sm:w-28">
                    <img src={activeCreator.baseImageUrl} alt={activeCreator.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 max-w-2xl">
                    <div className="flex items-center gap-3">
                      <h1 className="truncate text-[clamp(2rem,4vw,2.95rem)] font-semibold tracking-[-0.05em] text-[#111111]">{activeCreator.name}</h1>
                      <span className="rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[11px] font-medium text-[#15803D]">Active</span>
                    </div>
                    <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#666666]">
                      {activeCreator.description ?? 'Natural, relatable UGC creator with a warm, friendly tone.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#666666]">
                      <span>{activeCreator.clipCount} clips</span>
                      <span>{formatUpdatedAt(activeCreator.updatedAt)}</span>
                      <span>{summaryTags.join(', ')}</span>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-center gap-2 self-start">
                  <button type="button" onClick={() => setActiveTab('details')} className="inline-flex items-center gap-2 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-medium text-[#111111] hover:border-black">
                    <Pencil size={15} />
                    Edit creator
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCreatorActions((current) => !current)}
                      className={iconButtonClass}
                      aria-label="More options"
                    >
                      <ChevronDown size={16} />
                    </button>
                    {showCreatorActions ? (
                      <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-[18px] border border-[#ECECEC] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.08)]">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('details');
                            setShowCreatorActions(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[#111111] hover:bg-[#FAFAF8]"
                        >
                          <Pencil size={15} />
                          Edit creator
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreatorActions(false);
                            void deleteCreator();
                          }}
                          className="flex w-full items-center gap-2 border-t border-[#ECECEC] px-4 py-3 text-left text-sm text-[#991b1b] hover:bg-[#FFF5F5]"
                        >
                          <Trash2 size={15} />
                          Delete creator
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#ECECEC] bg-[#FAFAF8] p-8 text-[15px] leading-7 text-[#666666]">
                Select a creator to view and manage its clips.
              </div>
            )}
          </div>

          {activeCreator ? (
            <div className="space-y-4">
              <div className="flex items-center gap-8 border-b border-[#ECECEC] px-1">
                {([
                  ['clips', 'Clips'],
                  ['details', 'Details'],
                  ['usage', 'Usage'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`relative py-3 text-[14px] font-medium transition ${activeTab === key ? 'text-[#111111]' : 'text-[#666666] hover:text-[#111111]'}`}
                  >
                    {label}
                    <span className={`absolute inset-x-0 bottom-[-1px] h-px ${activeTab === key ? 'bg-black' : 'bg-transparent'}`} />
                  </button>
                ))}
              </div>

              {activeTab === 'clips' ? (
                <div className={`${shellClass} px-5 py-5 sm:px-6 sm:py-6`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#111111]">All clips ({selectedClipCount})</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setClipModal({
                            mode: 'create',
                            clip: {
                              id: 'new',
                              creatorId: activeCreator.id,
                              title: '',
                              url: '',
                              provider: '',
                              providerId: null,
                              mimeType: 'video/mp4',
                              metadata: null,
                              tags: [],
                              sortOrder: activeCreator.clips.length,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            },
                          })
                        }
                        className={subtleButtonClass}
                      >
                        <Upload size={15} />
                        Add clip
                      </button>
                      <select value={clipTypeFilter} onChange={(event) => setClipTypeFilter(event.target.value as ClipTypeFilter)} className="rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm text-[#111111] outline-none transition focus:border-black">
                        <option value="all">All types</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                      </select>
                      <select value={clipSortOrder} onChange={(event) => setClipSortOrder(event.target.value as ClipSortOrder)} className="rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm text-[#111111] outline-none transition focus:border-black">
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {visibleClips.map((clip) => (
                      <ClipCard key={clip.id} clip={clip} onOpen={(currentClip) => setClipModal({ mode: 'edit', clip: currentClip })} />
                    ))}
                    {!visibleClips.length ? (
                      <div className="rounded-[18px] border border-dashed border-[#ECECEC] bg-[#FAFAF8] p-5 text-sm text-[#666666] sm:col-span-2 lg:col-span-3 xl:col-span-5">
                        No clips match the current filters.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm text-[#111111] hover:border-black">
                      Load more clips
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              ) : null}

              {activeTab === 'details' ? (
                <div className={`${shellClass} px-5 py-5 sm:px-6 sm:py-6`}>
                  <DetailsPanel
                    creator={activeCreator}
                    busy={busy === 'Saving creator' || busy === 'Deleting creator'}
                    editName={editName}
                    setEditName={setEditName}
                    editDescription={editDescription}
                    setEditDescription={setEditDescription}
                    editSortOrder={editSortOrder}
                    setEditSortOrder={setEditSortOrder}
                    editBaseImage={editBaseImage}
                    setEditBaseImage={setEditBaseImage}
                    editBaseImagePreview={editBaseImagePreview}
                    onSave={saveCreator}
                    onDelete={deleteCreator}
                  />
                </div>
              ) : null}

              {activeTab === 'usage' ? (
                <div className={`${shellClass} px-5 py-5 sm:px-6 sm:py-6`}>
                  <div className="rounded-[24px] border border-dashed border-[#ECECEC] bg-[#FAFAF8] p-8">
                    <p className={labelClass}>Usage</p>
                    <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-[#111111]">Reserved for campaign placement</h3>
                    <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#666666]">
                      This tab can later show where the creator is used across projects. It is intentionally quiet for now so the core creator workflow stays focused.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <CreatorModal open={createOpen} busy={busy === 'Creating creator'} onClose={() => setCreateOpen(false)} onCreate={createCreator} />

      <ClipModal
        mode={clipModal?.mode ?? 'edit'}
        clip={clipModal?.clip ?? null}
        creatorName={activeCreator?.name ?? 'Creator'}
        open={clipModal !== null}
        busy={busy === `Saving clip ${clipModal?.clip?.id ?? ''}` || busy === `Deleting clip ${clipModal?.clip?.id ?? ''}` || busy === 'Uploading clip'}
        onClose={() => setClipModal(null)}
        onSave={clipModal?.mode === 'create' ? uploadClip : async ({ tags, title }) => {
          if (!clipModal?.clip) return;
          await saveClip(clipModal.clip.id, tags, title);
        }}
        onDelete={clipModal?.mode === 'edit' ? deleteClip : undefined}
      />

      {error ? (
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 sm:px-8 lg:px-20">
          <div className="rounded-[24px] border border-[#F1D6D6] bg-[#FFF5F5] px-4 py-3 text-sm text-[#991b1b]">{error}</div>
        </div>
      ) : null}
    </main>
  );
}
