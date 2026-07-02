import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Header } from './Header';
import { Type, Palette, Move, Play, Pause, SkipBack, SkipForward, Download, ChevronLeft, Eye, EyeOff, AlignCenter, AlignLeft, AlignRight, Loader2, Music } from 'lucide-react';
import { api } from '../lib/api';
import type { Script } from '../types/domain';

// ── Types ──
interface Scene {
  narration?: string;
  onScreenText?: string;
  imagePrompt?: string;
  generatedVideoUrl?: string;
  generatedImageUrl?: string;
  featuresCharacter?: boolean;
  featuresProduct?: boolean;
}

interface TextOverlaySettings {
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  position: { x: number; y: number };
  textAlign: 'left' | 'center' | 'right';
  visible: boolean;
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number;
}

const PRESET_COLORS = [
  '#FFFFFF', '#FFDE00', '#00F0FF', '#FF00F0', '#00FF85',
  '#FF4444', '#FF8800', '#8844FF', '#000000',
];

const FONT_OPTIONS = [
  'Impact', 'Arial Black', 'Montserrat', 'Oswald', 'Bebas Neue', 'Anton',
];

const DEFAULT_SETTINGS: TextOverlaySettings = {
  fontSize: 42,
  fontFamily: 'Impact',
  color: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 3,
  position: { x: 50, y: 80 },
  textAlign: 'center',
  visible: true,
  bgEnabled: false,
  bgColor: '#000000',
  bgOpacity: 60,
};

const overlayPosition = (settings: TextOverlaySettings, width: number, height: number) => ({
  x: (settings.position.x / 100) * width,
  y: (settings.position.y / 100) * height,
});

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scriptId = '' } = useParams();
  const state = location.state as { script?: Script } | null;
  const [script, setScript] = useState<Script | null>(state?.script ?? null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => { if (script || !scriptId) return; void api<Script>(`/scripts/${scriptId}`).then(setScript).catch(error => setLoadError(error instanceof Error ? error.message : 'Unable to load script')); }, [script, scriptId]);

  // Extract scenes with videos
  const scenes: Scene[] = script?.scenes ?? [];
  const videoScenes = scenes.filter(s => s.generatedVideoUrl);

  // ── Playback state ──
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [settings, setSettings] = useState<TextOverlaySettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'text' | 'position' | 'style' | 'audio'>('text');

  // ── Audio State ──
  const [bgAudioUrl, setBgAudioUrl] = useState<string>('/assets/music/messvsmasterpiece.mp3');
  const [bgAudioVolume, setBgAudioVolume] = useState<number>(30); // 0-100
  const [videoVolume, setVideoVolume] = useState<number>(100); // 0-100
  const bgAudioRef = useRef<HTMLAudioElement>(null);

  // ── Export state ──
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');

  const currentScene = videoScenes[currentSceneIdx] || null;
  const currentText = currentScene?.onScreenText || currentScene?.narration || '';

  // ── Video event handlers ──
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (currentSceneIdx < videoScenes.length - 1) {
      setCurrentSceneIdx(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentSceneIdx(0);
    }
  }, [currentSceneIdx, videoScenes.length]);

  // Auto-play next scene & sync audio
  useEffect(() => {
    if (isPlaying) {
      videoRef.current?.play().catch(() => {});
      bgAudioRef.current?.play().catch(() => {});
    } else {
      bgAudioRef.current?.pause();
    }
  }, [currentSceneIdx, isPlaying]);

  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = bgAudioVolume / 100;
    }
  }, [bgAudioVolume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume / 100;
    }
  }, [videoVolume, currentSceneIdx]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      bgAudioRef.current?.pause();
    } else {
      videoRef.current.play().catch(() => {});
      bgAudioRef.current?.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const goToScene = (idx: number) => {
    setCurrentSceneIdx(Math.max(0, Math.min(idx, videoScenes.length - 1)));
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const seekTo = (pct: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = pct * videoRef.current.duration;
    }
  };

  const updateSetting = <K extends keyof TextOverlaySettings>(key: K, value: TextOverlaySettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // ── No videos fallback ──
  if (!script && !loadError) return <div className="min-h-screen bg-[#0A0A0A] text-white grid place-items-center">Loading editor…</div>;
  if (videoScenes.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <Header type="landing" onGoToLanding={() => navigate('/')} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-6xl opacity-20">🎬</div>
          <h2 className="text-2xl font-bold">No Videos Available</h2>
          <p className="text-zinc-500 max-w-md text-center">
            {loadError || 'Generate videos for your script scenes first, then come back to the editor to add text overlays.'}
          </p>
          <button onClick={() => navigate(-1)} className="px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Export: Canvas + MediaRecorder ──
  const handleExport = async () => {
    if (videoScenes.length === 0) return;
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      setExportStatus('WebM export is not supported in this browser. Use current Chrome, Edge, or Firefox on desktop.');
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Preparing export...');

    const cleanup: Array<() => void> = [];
    try {

    // Pause any current playback
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);

    const CANVAS_W = 720;
    const CANVAS_H = 1280;

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d')!;

    // ── Web Audio API Mix ──
    const audioCtx = new AudioContext();
    cleanup.push(() => { if (audioCtx.state !== 'closed') void audioCtx.close(); });
    const dest = audioCtx.createMediaStreamDestination();

    let bgAudioSource: AudioBufferSourceNode | null = null;
    let bgGain: GainNode | null = null;
    if (bgAudioUrl) {
      try {
        const bgRes = await fetch(bgAudioUrl);
        const bgBuf = await bgRes.arrayBuffer();
        const decodedBuf = await audioCtx.decodeAudioData(bgBuf);
        bgAudioSource = audioCtx.createBufferSource();
        bgAudioSource.buffer = decodedBuf;
        bgAudioSource.loop = true;

        bgGain = audioCtx.createGain();
        bgGain.gain.value = bgAudioVolume / 100;

        bgAudioSource.connect(bgGain);
        bgGain.connect(dest);
        bgAudioSource.start();
        cleanup.push(() => { try { bgAudioSource?.stop(); } catch { /* already stopped */ } bgAudioSource?.disconnect(); bgGain?.disconnect(); });
      } catch (err) {
        console.warn('Failed to load bg audio for export', err);
      }
    }

    const stream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);
    cleanup.push(() => combinedStream.getTracks().forEach(track => track.stop()));

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm',
      videoBitsPerSecond: 5_000_000,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const drawTextOverlay = (text: string) => {
      if (!settings.visible || !text) return;
      ctx.save();
      ctx.font = `bold ${settings.fontSize * (CANVAS_W / 360)}px ${settings.fontFamily}`;
      ctx.textAlign = settings.textAlign;
      ctx.textBaseline = 'middle';

      const { x, y } = overlayPosition(settings, CANVAS_W, CANVAS_H);

      // Wrap text
      const maxWidth = CANVAS_W - 48;
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = settings.fontSize * (CANVAS_W / 360) * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = y - totalHeight / 2 + lineHeight / 2;

      // Background
      if (settings.bgEnabled) {
        const bgPad = 16;
        let bgWidth = 0;
        for (const line of lines) bgWidth = Math.max(bgWidth, ctx.measureText(line).width);
        const hexR = parseInt(settings.bgColor.slice(1, 3), 16);
        const hexG = parseInt(settings.bgColor.slice(3, 5), 16);
        const hexB = parseInt(settings.bgColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${hexR},${hexG},${hexB},${settings.bgOpacity / 100})`;
        const bgX = settings.textAlign === 'center' ? x - bgWidth / 2 - bgPad : settings.textAlign === 'right' ? x - bgWidth - bgPad : x - bgPad;
        ctx.fillRect(bgX, startY - lineHeight / 2 - bgPad / 2, bgWidth + bgPad * 2, totalHeight + bgPad);
      }

      // Draw text
      lines.forEach((line, i) => {
        const ly = startY + i * lineHeight;
        if (settings.strokeWidth > 0) {
          ctx.strokeStyle = settings.strokeColor;
          ctx.lineWidth = settings.strokeWidth * 2 * (CANVAS_W / 360);
          ctx.lineJoin = 'round';
          ctx.strokeText(line, x, ly);
        }
        ctx.fillStyle = settings.color;
        ctx.fillText(line, x, ly);
      });
      ctx.restore();
    };

    const drawVideoCover = (video: HTMLVideoElement) => {
      const scale = Math.max(CANVAS_W / video.videoWidth, CANVAS_H / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      ctx.drawImage(video, (CANVAS_W - width) / 2, (CANVAS_H - height) / 2, width, height);
    };

    // Record each scene sequentially
    mediaRecorder.start();

    for (let i = 0; i < videoScenes.length; i++) {
      const scene = videoScenes[i];
      const text = scene.onScreenText || scene.narration || '';
      setExportProgress(Math.round((i / videoScenes.length) * 100));
      setExportStatus(`Recording scene ${i + 1} of ${videoScenes.length}...`);

      await new Promise<void>((resolve, reject) => {
        const vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.playsInline = true;
        vid.src = scene.generatedVideoUrl!;

        let sourceNode: MediaElementAudioSourceNode | null = null;
        let videoGain: GainNode | null = null;
        let animationFrame = 0;
        const disposeVideo = () => {
          cancelAnimationFrame(animationFrame);
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
          sourceNode?.disconnect();
          videoGain?.disconnect();
        };

        vid.onloadeddata = () => {
          try {
            sourceNode = audioCtx.createMediaElementSource(vid);
            videoGain = audioCtx.createGain();
            videoGain.gain.value = videoVolume / 100;
            sourceNode.connect(videoGain);
            videoGain.connect(dest);
          } catch(e) {
            console.warn('Could not connect video audio', e);
          }

          vid.play().catch(reject);

          const drawFrame = () => {
            if (vid.paused || vid.ended) return;
            drawVideoCover(vid);
            drawTextOverlay(text);
            animationFrame = requestAnimationFrame(drawFrame);
          };
          animationFrame = requestAnimationFrame(drawFrame);
        };

        vid.onended = () => {
          // Draw one last frame
          drawVideoCover(vid);
          drawTextOverlay(text);
          disposeVideo();
          resolve();
        };

        vid.onerror = () => { disposeVideo(); reject(new Error(`Failed to load scene ${i + 1}`)); };
      });
    }

    setExportStatus('Finalizing video...');
    setExportProgress(95);

    mediaRecorder.stop();

    await new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve();
    });

    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reelswarm-export-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setExportProgress(100);
    setExportStatus('Done!');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Export failed');
    } finally {
      cleanup.reverse().forEach(dispose => { try { dispose(); } catch { /* best-effort cleanup */ } });
      setIsExporting(false);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (<>
    <div className="md:hidden min-h-screen bg-[#0A0A0A] text-white grid place-items-center p-8 text-center"><div><h1 className="text-2xl font-bold">Desktop editor recommended</h1><p className="text-zinc-400 mt-3">Use a tablet or desktop browser for reliable preview and WebM export.</p><button onClick={() => navigate(-1)} className="mt-6 px-5 py-3 bg-white text-black rounded-xl font-bold">Back to scripts</button></div></div>
    <div className="hidden h-screen bg-[#0A0A0A] text-white font-sans md:flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <nav className="sticky top-0 z-50 px-6 py-3 border-b border-white/[0.06] bg-[#0A0A0A]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-lg font-bold tracking-tighter hover:opacity-80 transition-opacity">
              REEL<span className="text-blue-500">SWARM</span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft size={14} /> Back to Scripts
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              {videoScenes.length} scene{videoScenes.length !== 1 ? 's' : ''}
            </div>
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left Panel: Controls ── */}
        <div className="w-[340px] border-r border-white/[0.06] bg-[#0A0A0A] shrink-0 flex flex-col">
          {/* Tab Bar */}
          <div className="flex border-b border-white/[0.06]">
            {[
              { id: 'text' as const, icon: <Type size={14} />, label: 'Text' },
              { id: 'style' as const, icon: <Palette size={14} />, label: 'Style' },
              { id: 'position' as const, icon: <Move size={14} />, label: 'Position' },
              { id: 'audio' as const, icon: <Music size={14} />, label: 'Audio' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                    : 'text-zinc-600 border-transparent hover:text-zinc-400'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">

            {/* ── TEXT TAB ── */}
            {activeTab === 'text' && (
              <>
                {/* Toggle Visibility */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Text Overlay</span>
                  <button
                    onClick={() => updateSetting('visible', !settings.visible)}
                    className={`p-2 rounded-lg border transition-all ${settings.visible ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
                  >
                    {settings.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>

                {/* Font Size */}
                <div>
                  <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    <span>Font Size</span>
                    <span className="text-white">{settings.fontSize}px</span>
                  </label>
                  <input
                    type="range" min={16} max={80} step={1}
                    value={settings.fontSize}
                    onChange={e => updateSetting('fontSize', Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Font Family */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Font</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map(font => (
                      <button
                        key={font}
                        onClick={() => updateSetting('fontFamily', font)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                          settings.fontFamily === font
                            ? 'bg-blue-500/10 border-blue-500/30 text-white'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                        }`}
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Alignment */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Alignment</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'left' as const, icon: <AlignLeft size={14} /> },
                      { value: 'center' as const, icon: <AlignCenter size={14} /> },
                      { value: 'right' as const, icon: <AlignRight size={14} /> },
                    ].map(a => (
                      <button
                        key={a.value}
                        onClick={() => updateSetting('textAlign', a.value)}
                        className={`flex-1 flex items-center justify-center py-2 rounded-lg border transition-all ${
                          settings.textAlign === a.value
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:text-white'
                        }`}
                      >
                        {a.icon}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── STYLE TAB ── */}
            {activeTab === 'style' && (
              <>
                {/* Text Color */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Text Color</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => updateSetting('color', c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          settings.color === c ? 'border-blue-400 ring-2 ring-blue-500/30 scale-110' : 'border-zinc-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={settings.color}
                      onChange={e => updateSetting('color', e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-2 border-dashed border-zinc-700"
                    />
                  </div>
                </div>

                {/* Stroke Color */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Stroke Color</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => updateSetting('strokeColor', c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          settings.strokeColor === c ? 'border-blue-400 ring-2 ring-blue-500/30 scale-110' : 'border-zinc-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stroke Width */}
                <div>
                  <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    <span>Stroke Width</span>
                    <span className="text-white">{settings.strokeWidth}px</span>
                  </label>
                  <input
                    type="range" min={0} max={8} step={1}
                    value={settings.strokeWidth}
                    onChange={e => updateSetting('strokeWidth', Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Background */}
                <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Text Background</span>
                    <button
                      onClick={() => updateSetting('bgEnabled', !settings.bgEnabled)}
                      className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full border transition-all ${
                        settings.bgEnabled ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'border-zinc-800 text-zinc-600'
                      }`}
                    >
                      {settings.bgEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  {settings.bgEnabled && (
                    <div>
                      <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                        <span>Opacity</span>
                        <span className="text-white">{settings.bgOpacity}%</span>
                      </label>
                      <input
                        type="range" min={10} max={100} step={5}
                        value={settings.bgOpacity}
                        onChange={e => updateSetting('bgOpacity', Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── POSITION TAB ── */}
            {activeTab === 'position' && (
              <>
                <div>
                  <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    <span>Horizontal (X)</span>
                    <span className="text-white">{settings.position.x}%</span>
                  </label>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={settings.position.x}
                    onChange={e => updateSetting('position', { ...settings.position, x: Number(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    <span>Vertical (Y)</span>
                    <span className="text-white">{settings.position.y}%</span>
                  </label>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={settings.position.y}
                    onChange={e => updateSetting('position', { ...settings.position, y: Number(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                {/* Quick Position Presets */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Quick Position</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Top', x: 50, y: 12 },
                      { label: 'Center', x: 50, y: 50 },
                      { label: 'Bottom', x: 50, y: 85 },
                      { label: 'Top Left', x: 20, y: 12 },
                      { label: 'Mid Left', x: 20, y: 50 },
                      { label: 'Bot Left', x: 20, y: 85 },
                    ].map(p => (
                      <button
                        key={p.label}
                        onClick={() => updateSetting('position', { x: p.x, y: p.y })}
                        className={`px-2 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg border transition-all ${
                          settings.position.x === p.x && settings.position.y === p.y
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── AUDIO TAB ── */}
            {activeTab === 'audio' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Background Music</label>
                  <div className="flex flex-col gap-2">
                    {['/assets/music/messvsmasterpiece.mp3'].map(track => (
                      <button
                        key={track}
                        onClick={() => {
                          setBgAudioUrl(track);
                          if (isPlaying && bgAudioRef.current) bgAudioRef.current.play();
                        }}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                          bgAudioUrl === track
                            ? 'bg-blue-500/10 border-blue-500/30 text-white'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        {track.split('/').pop()}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setBgAudioUrl('');
                        if (bgAudioRef.current) bgAudioRef.current.pause();
                      }}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                        !bgAudioUrl
                          ? 'bg-blue-500/10 border-blue-500/30 text-white'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>

                <div>
                  <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 mt-4">
                    <span>Music Volume</span>
                    <span className="text-white">{bgAudioVolume}%</span>
                  </label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={bgAudioVolume}
                    onChange={e => setBgAudioVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 mt-4">
                    <span>Video Voiceover Volume</span>
                    <span className="text-white">{videoVolume}%</span>
                  </label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={videoVolume}
                    onChange={e => setVideoVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* ── Scene List ── */}
          <div className="border-t border-white/[0.06] p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Scenes</div>
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar">
              {videoScenes.map((scene, idx) => (
                <button
                  key={idx}
                  onClick={() => goToScene(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all ${
                    currentSceneIdx === idx
                      ? 'bg-blue-500/10 border border-blue-500/20 text-white'
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      currentSceneIdx === idx ? 'bg-blue-500 text-black' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{(scene.onScreenText || scene.narration || `Scene ${idx + 1}`).slice(0, 50)}{((scene.onScreenText || scene.narration || '').length) > 50 ? '...' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Video Preview ── */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-8 gap-6 relative">
          
          {/* Background Audio Player */}
          {bgAudioUrl && (
            <audio 
              ref={bgAudioRef} 
              src={bgAudioUrl} 
              loop 
              crossOrigin="anonymous" 
            />
          )}

          {/* Video Container (9:16 aspect) */}
          <div className="relative w-full max-w-[360px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            {currentScene?.generatedVideoUrl ? (
              <video
                ref={videoRef}
                key={currentScene.generatedVideoUrl}
                src={currentScene.generatedVideoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                crossOrigin="anonymous"
                playsInline
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-zinc-700 text-4xl">🎬</div>
              </div>
            )}

            {/* Text Overlay */}
            {settings.visible && currentText && (
              <div
                className="absolute pointer-events-none px-4 w-[92%]"
                style={{
                  left: `${settings.position.x}%`,
                  top: `${settings.position.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  style={{
                    textAlign: settings.textAlign,
                  }}
                >
                  {settings.bgEnabled && (
                    <div
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backgroundColor: settings.bgColor,
                        opacity: settings.bgOpacity / 100,
                      }}
                    />
                  )}
                  <p
                    className="relative leading-tight font-bold"
                    style={{
                      fontFamily: settings.fontFamily,
                      fontSize: `${settings.fontSize}px`,
                      color: settings.color,
                      WebkitTextStroke: settings.strokeWidth > 0 ? `${settings.strokeWidth}px ${settings.strokeColor}` : undefined,
                      paintOrder: 'stroke fill',
                      textShadow: `0 2px 8px rgba(0,0,0,0.6)`,
                      wordBreak: 'break-word',
                    }}
                  >
                    {currentText}
                  </p>
                </div>
              </div>
            )}

            {/* Scene indicator */}
            <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-bold text-white/80 uppercase tracking-widest">
              Scene {currentSceneIdx + 1}/{videoScenes.length}
            </div>
          </div>

          {/* ── Playback Controls ── */}
          <div className="w-full max-w-[420px] space-y-3">
            {/* Progress Bar */}
            <div
              className="group relative h-1.5 bg-zinc-800 rounded-full cursor-pointer overflow-hidden"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-[width] duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div className="absolute inset-0 bg-blue-400/0 group-hover:bg-blue-400/10 transition-colors rounded-full" />
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-600 w-12">
                {formatTime(currentTime)}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => goToScene(currentSceneIdx - 1)}
                  disabled={currentSceneIdx === 0}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <button
                  onClick={() => goToScene(currentSceneIdx + 1)}
                  disabled={currentSceneIdx >= videoScenes.length - 1}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <SkipForward size={16} />
                </button>
              </div>

              <span className="text-[10px] font-mono text-zinc-600 w-12 text-right">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Export Modal ── */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Loader2 size={28} className="text-green-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">Exporting Video</h3>
              <p className="text-sm text-zinc-500">{exportStatus}</p>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="text-xs font-bold text-zinc-400">{exportProgress}%</div>
          </div>
        </div>
      )}
    </div>
  </>);
}
