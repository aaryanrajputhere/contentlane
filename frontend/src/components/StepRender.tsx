import React, { useState, useEffect } from 'react';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { PlayerComposition } from './PlayerComposition';
import type { VoiceoverResult } from '../types';

interface Props {
  voiceoverResult: VoiceoverResult;
  videoUrl: string | null;
  onVideoRendered: (url: string) => void;
  onClearRender: () => void;
  onBack: () => void;
  styles: {
    subtitleFontSize: number;
    setSubtitleFontSize: (v: number) => void;
    subtitleX: number;
    setSubtitleX: (v: number) => void;
    subtitleY: number;
    setSubtitleY: (v: number) => void;
    activeColor: string;
    setActiveColor: (v: string) => void;
    inactiveColor: string;
    setInactiveColor: (v: string) => void;
    characterX: number;
    setCharacterX: (v: number) => void;
    characterY: number;
    setCharacterY: (v: number) => void;
    characterScale: number;
    setCharacterScale: (v: number) => void;
    bgVideoUrl: string;
    setBgVideoUrl: (v: string) => void;
    videoSpeed?: number;
    setVideoSpeed?: (v: number) => void;
    layoutMode: string;
    setLayoutMode: (v: string) => void;
  };
  characters: any[];
  customLayoutStyles: Record<string, any>;
}

const FPS = 24;

const PRESET_COLORS = [
  { name: 'Yellow', value: '#FFDE00' },
  { name: 'Cyan', value: '#00F0FF' },
  { name: 'Magenta', value: '#FF00F0' },
  { name: 'Green', value: '#00FF85' },
  { name: 'White', value: '#FFFFFF' },
];

const StepRender: React.FC<Props> = ({
  voiceoverResult,
  videoUrl,
  onVideoRendered,
  onClearRender,
  styles,
  characters,
  customLayoutStyles
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  // ── Background video list ──
  interface BgVideo { filename: string; url: string; name: string; }
  const [backgrounds, setBackgrounds] = useState<BgVideo[]>([]);
  const [bgLoading, setBgLoading] = useState(true);

  useEffect(() => {
    fetch('/api/backgrounds')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: BgVideo[]) => setBackgrounds(data))
      .catch(() => console.error('Failed to load backgrounds'))
      .finally(() => setBgLoading(false));
  }, []);

  const durationInFrames = Math.max(1, Math.ceil((voiceoverResult.totalDuration / (styles.videoSpeed || 1)) * FPS));

  const inputProps = {
    sessionId: voiceoverResult.sessionId,
    totalDuration: voiceoverResult.totalDuration,
    scenes: voiceoverResult.scenes,
    bgVideoUrl: styles.bgVideoUrl || voiceoverResult.bgVideoUrl,
    subtitleFontSize: styles.subtitleFontSize,
    subtitleY: styles.subtitleY,
    subtitleX: styles.subtitleX,
    subtitleActiveColor: styles.activeColor,
    subtitleInactiveColor: styles.inactiveColor,
    characterX: styles.characterX,
    characterY: styles.characterY,
    characterScale: styles.characterScale,
    bgObjectFit: 'cover',
    videoSpeed: styles.videoSpeed || 1,
    layout: styles.layoutMode,
    characters: characters,
    customLayoutStyles: customLayoutStyles,
    isEditorPreview: false,
  };

  const handleRender = async () => {
    setLoading(true);
    setError('');
    setProgress(0);
    try {
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          component: PlayerComposition as any,
          id: 'reelswarm-video',
          durationInFrames,
          fps: FPS,
          width: 720,
          height: 1280,
          defaultProps: inputProps,
        },
        inputProps,
        onProgress: ({ progress: p }: { progress: number }) => {
          setProgress(p);
        },
        videoBitrate: 'high',
      });

      const blob = await getBlob();
      const localUrl = URL.createObjectURL(blob);
      onVideoRendered(localUrl);
    } catch (e: any) {
      console.error('Render error:', e);
      setError(e.message || 'An unknown error occurred during rendering.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#050505] border border-zinc-900 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-white mb-2">4. Polish & Export</h2>
        <p className="text-zinc-500 text-sm">Fine-tune your layout and colors for maximum engagement.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Subtitle Styling */}
        <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-dodgerblue mb-4">Subtitle Styling</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-2 flex justify-between">
                <span>Font Size</span>
                <span className="text-white">{styles.subtitleFontSize}px</span>
              </label>
              <input 
                type="range" 
                min="40" 
                max="160" 
                step="2"
                value={styles.subtitleFontSize}
                onChange={(e) => styles.setSubtitleFontSize(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-dodgerblue"
              />
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <div>
                <label className="block text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-2">Active</label>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c.value} className={`w-5 h-5 rounded-full border ${styles.activeColor === c.value ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.value }} onClick={() => styles.setActiveColor(c.value)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-2">Inactive</label>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c.value} className={`w-5 h-5 rounded-full border ${styles.inactiveColor === c.value ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.value }} onClick={() => styles.setInactiveColor(c.value)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-900">
            <label className="block text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-3">Playback Speed</label>
            <div className="flex flex-wrap gap-2">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3].map(speed => (
                <button
                  key={speed}
                  onClick={() => styles.setVideoSpeed?.(speed)}
                  className={`px-2.5 py-1 text-[9px] font-black rounded-md border transition-colors ${
                    (styles.videoSpeed || 1) === speed 
                      ? 'bg-dodgerblue text-black border-dodgerblue shadow-[0_0_10px_rgba(48,128,255,0.4)]'
                      : 'bg-[#111] border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actor Layout */}
        <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-dodgerblue mb-1">Character Layout</h4>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Position characters on canvas</p>
            </div>
            
            {/* Layout Dropdown */}
            <div className="relative" id="layout-dropdown-container">
              <button 
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                onClick={() => {
                  const el = document.getElementById('layout-popover');
                  if (el) el.classList.toggle('hidden');
                }}
              >
                <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                {styles.layoutMode}
                <svg className="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Popover Grid */}
              <div id="layout-popover" className="hidden absolute right-0 top-full mt-2 w-72 bg-[#0F0F0F] border border-zinc-800 rounded-2xl shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'classic', name: 'Classic', speakers: 1, preview: <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-8 rounded-md border border-pink-500 bg-indigo-500/20" /> },
                    { id: 'split', name: 'Split Screen', speakers: 2, preview: <><div className="absolute top-1/2 -translate-y-1/2 left-2 w-5 h-8 rounded-md border border-pink-500 bg-indigo-500/20" /><div className="absolute top-1/2 -translate-y-1/2 right-2 w-5 h-8 rounded-md border border-pink-500 bg-indigo-500/20" /></> },
                    { id: 'stacked', name: 'Stacked', speakers: 2, preview: <><div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-md border border-pink-500 bg-indigo-500/20" /><div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-md border border-pink-500 bg-indigo-500/20" /></> },
                    { id: 'pip', name: 'Picture-in-Picture', speakers: 2, preview: <><div className="absolute inset-2 rounded-md border border-pink-500 bg-indigo-500/20" /><div className="absolute top-1 right-1 w-3 h-4 rounded-sm border border-pink-500 bg-dodgerblue/50" /></> },
                    { id: 'debate', name: 'Debate', speakers: 2, preview: <><div className="absolute bottom-2 left-1 w-5 h-7 rounded-md border border-pink-500 bg-indigo-500/20" /><div className="absolute bottom-2 right-1 w-5 h-7 rounded-md border border-pink-500 bg-indigo-500/20" /></> },
                    { id: 'solo', name: 'Solo', speakers: 1, preview: <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-8 rounded-md border border-pink-500 bg-indigo-500/20" /> }
                  ].map(layout => (
                    <button 
                      key={layout.id}
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all ${styles.layoutMode === layout.id ? 'bg-[#1A1A24] border-indigo-500/50' : 'bg-[#111] border-zinc-800 hover:border-zinc-600'}`}
                      onClick={() => {
                         styles.setLayoutMode(layout.id);
                         const el = document.getElementById('layout-popover');
                         if (el) el.classList.add('hidden');
                      }}
                    >
                      <div className="w-10 h-16 bg-zinc-400 rounded-lg relative mb-3 overflow-hidden shadow-inner opacity-80">
                        {layout.preview}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white mb-0.5">{layout.name}</span>
                      <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500">{layout.speakers} speaker{layout.speakers > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start flex-1">
            <div className="w-20 h-20 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 flex-shrink-0 relative group">
              <div className="absolute inset-0 bg-dodgerblue/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              {voiceoverResult.scenes[0]?.imageUrl ? (
                <img 
                  src={voiceoverResult.scenes[0].imageUrl} 
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110" 
                  alt="Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-xs">NO IMG</div>
              )}
            </div>
            <div className="flex-1 space-y-4 pt-1">
              {styles.layoutMode === 'classic' ? (
                <>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-2 flex justify-between">
                      <span>Character Scale</span>
                      <span className="text-white">{styles.characterScale}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="1"
                      value={styles.characterScale}
                      onChange={(e) => styles.setCharacterScale(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-dodgerblue"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-2 text-center">X Position</label>
                      <input type="range" min="-50" max="150" value={styles.characterX} onChange={(e) => styles.setCharacterX(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-dodgerblue" />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-zinc-600 font-black mb-2 text-center">Y Position</label>
                      <input type="range" min="-50" max="150" value={styles.characterY} onChange={(e) => styles.setCharacterY(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-dodgerblue" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 border border-dashed border-dodgerblue/30 rounded-xl bg-dodgerblue/5 text-center transition-all group hover:bg-dodgerblue/10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-dodgerblue mb-1">Layout Active</span>
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400">Drag actors directly in the monitor to fine-tune!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Background Video Picker */}
      <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-dodgerblue mb-4">Background Video</h4>
        {bgLoading ? (
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-1 h-24 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : backgrounds.length === 0 ? (
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">No background videos found in /public/assets/</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {backgrounds.map((bg) => {
              const isSelected = styles.bgVideoUrl === bg.url;
              return (
                <button
                  key={bg.filename}
                  onClick={() => styles.setBgVideoUrl(bg.url)}
                  className={`relative group flex-1 min-w-[120px] max-w-[200px] rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-dodgerblue shadow-[0_0_20px_rgba(48,128,255,0.35)]'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <video
                    src={bg.url}
                    className="w-full h-24 object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity ${
                    isSelected ? 'bg-dodgerblue/30' : 'bg-black/50 opacity-0 group-hover:opacity-100'
                  }`}>
                    <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div className={`absolute bottom-0 left-0 right-0 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest truncate text-center transition-colors ${
                    isSelected ? 'text-dodgerblue bg-black/70' : 'text-zinc-400 bg-black/60'
                  }`}>
                    {bg.name}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-dodgerblue rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-2.5 h-2.5 fill-black" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 text-sm mb-8">
          ⚠ {error}
        </div>
      )}

      <div>
        {loading ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 flex flex-col items-center gap-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-zinc-800 rounded-full" />
              <div className="absolute inset-0 border-4 border-dodgerblue rounded-full animate-spin transition-all duration-300" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${progress * 100}%, 0 ${progress * 100}%)` }} />
              <span className="text-white font-black text-xs">{Math.round(progress * 100)}%</span>
            </div>
            <div className="text-center">
              <span className="block text-white font-black uppercase tracking-widest text-xs mb-1">In-Browser Render Active</span>
              <span className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">Fast hardware acceleration</span>
            </div>
          </div>
        ) : videoUrl ? (
          <div className="bg-dodgerblue/5 border border-dodgerblue/20 rounded-3xl p-8 flex flex-col items-center gap-6">
            {/* Success badge */}
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-3">
              <span className="text-emerald-400 text-lg">✓</span>
              <div>
                <p className="text-emerald-400 font-black text-[10px] uppercase tracking-widest">Render Complete</p>
                <p className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold">Your video is ready to download</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 w-full">
              <a
                className="flex-1 px-6 py-5 bg-dodgerblue text-black font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] text-center shadow-[0_10px_30px_rgba(48,128,255,0.2)]" 
                href={videoUrl} 
                download="reelswarm-video.mp4"
              >
                ⬇ Download MP4
              </a>
              <button
                className="flex-1 px-6 py-5 bg-zinc-900 border border-zinc-800 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all hover:bg-zinc-800 hover:border-zinc-700"
                onClick={onClearRender}
              >
                ✏ Re-edit
              </button>
            </div>

            {/* Re-render link */}
            <button
              className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
              onClick={handleRender}
            >
              🔄 Re-render with same settings
            </button>
          </div>
        ) : (
          <button className="w-full px-12 py-8 bg-dodgerblue text-black font-black uppercase tracking-widest text-sm rounded-3xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-[0_20px_50px_rgba(48,128,255,0.2)]" onClick={handleRender}>🎬 Export Final Video (MP4)</button>
        )}
      </div>
    </div>
  );
};

export default StepRender;
