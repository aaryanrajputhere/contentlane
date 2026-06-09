import React, { useRef, useState } from 'react';
import type { DialogueLine, VoiceoverResult } from '../types';

interface Props {
  dialogue: DialogueLine[];
  voiceoverResult: VoiceoverResult | null;
  onVoiceoverGenerated: (result: VoiceoverResult) => void;
  onNext: () => void;
  onBack: () => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const StepVoiceover: React.FC<Props> = ({
  dialogue,
  voiceoverResult,
  onVoiceoverGenerated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/voice/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialogue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onVoiceoverGenerated(data.data as VoiceoverResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (url: string, index: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingIndex === index) {
      setPlayingIndex(null);
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingIndex(index);
    audio.play();
    audio.onended = () => setPlayingIndex(null);
  };

  return (
    <div className="bg-[#050505] border border-zinc-900 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-white mb-2">3. Voice Synthesis</h2>
        <p className="text-zinc-500 text-sm">
          Convert the dialogue to speech with AI voices. This may take a minute.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 text-sm mb-6">
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-zinc-900 border-t-dodgerblue rounded-full animate-spin" />
          <div className="text-center">
            <span className="block text-white font-black uppercase tracking-widest text-xs mb-1">Generating voiceovers…</span>
            <span className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
              Processing {dialogue.length} dialogue lines
            </span>
          </div>
        </div>
      )}

      {!loading && !voiceoverResult && (
        <div className="text-center py-16 bg-[#0A0A0A] border border-zinc-900 rounded-2xl border-dashed">
          <p className="text-zinc-400 text-sm mb-8">
            Ready to generate voiceovers for <span className="text-dodgerblue font-bold">{dialogue.length} lines</span>.
          </p>
          <button
            className="px-8 py-4 bg-dodgerblue text-black font-black uppercase tracking-widest text-sm rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(48,128,255,0.3)] flex items-center justify-center gap-2 mx-auto"
            onClick={handleGenerate}
          >
            🎙️ Generate Voiceover
          </button>
        </div>
      )}

      {voiceoverResult && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-dodgerblue/10 border border-dodgerblue text-dodgerblue text-[10px] font-black uppercase tracking-widest rounded-full">
                ✓ Ready to Preview
              </span>
              <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                {formatTime(voiceoverResult.totalDuration)} Total Length
              </span>
            </div>
            <button
              className="text-[10px] uppercase tracking-widest font-black text-zinc-600 hover:text-dodgerblue transition-colors px-3 py-1 border border-zinc-900 rounded-lg"
              onClick={handleGenerate}
            >
              🔄 Re-generate
            </button>
          </div>

          <div className="space-y-3">
            {voiceoverResult.scenes.map((scene, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-[#0A0A0A] border border-zinc-900 rounded-xl group hover:border-zinc-800 transition-colors">
                <button
                  className={`w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center text-sm transition-all ${
                    playingIndex === i ? 'bg-dodgerblue text-black' : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                  onClick={() => playAudio(scene.audioUrl, i)}
                >
                  {playingIndex === i ? '⏸' : '▶'}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-dodgerblue">{scene.characterName}</span>
                    <span className="text-[10px] font-black text-zinc-600 font-mono">{formatTime(scene.start)}</span>
                  </div>
                  <div className="text-zinc-400 text-xs truncate">{scene.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StepVoiceover;
