import React, { useState } from 'react';
import type { DialogueLine, Script, Character, VoiceoverResult } from '../types';

interface Props {
  selectedCharacters: Character[];
  script: Script | null;
  onScriptGenerated: (script: Script | null) => void;
  onDialogueUpdate: (dialogue: DialogueLine[]) => void;
  voiceoverResult: VoiceoverResult | null;
  onVoiceoverResultUpdate: (result: VoiceoverResult | null) => void;
  sessionId: string;
  onNext: () => void;
  onBack: () => void;
}

// ── Script Templates ──
const TEMPLATES = [
  // Explain
  { category: 'Explain', emoji: '🧠', label: 'Explain Like I\'m 5', prompt: 'Explain {topic} like I\'m 5 years old, using viral characters' },
  { category: 'Explain', emoji: '⚡', label: 'Speed Run Explain', prompt: '{topic} explained in the most chaotic way possible' },
  { category: 'Explain', emoji: '🔬', label: 'Science Drop', prompt: 'The insane science behind {topic}' },
  { category: 'Explain', emoji: '📚', label: 'History Uncovered', prompt: 'The crazy real history of {topic} nobody talks about' },
  // Hot Take
  { category: 'Hot Take', emoji: '🌶️', label: 'Controversial Opinion', prompt: 'Controversial hot take: {topic} is actually overrated' },
  { category: 'Hot Take', emoji: '💣', label: 'Truth Bomb', prompt: 'The uncomfortable truth about {topic} that nobody wants to admit' },
  { category: 'Hot Take', emoji: '🔥', label: 'vs Battle', prompt: '{topic} vs [rival] — who actually wins?' },
  // Would You Rather
  { category: 'Would You Rather', emoji: '🤔', label: 'Classic Dilemma', prompt: 'Would you rather {topic} — debate it' },
  { category: 'Would You Rather', emoji: '😱', label: 'Impossible Choice', prompt: 'Impossible choice: {topic} — no right answer' },
  // Conspiracy
  { category: 'Conspiracy', emoji: '👁️', label: 'What If Theory', prompt: 'What if {topic} was secretly a massive conspiracy?' },
  { category: 'Conspiracy', emoji: '🕵️', label: 'They Don\'t Want You To Know', prompt: 'The real reason behind {topic} that they don\'t want you to know' },
  // Fun Facts
  { category: 'Fun Facts', emoji: '😲', label: 'Mind-Blowing Fact', prompt: 'Mind-blowing facts about {topic} that will break your brain' },
  { category: 'Fun Facts', emoji: '🎲', label: 'Did You Know', prompt: 'Did you know {topic} — the facts are insane' },
  // Life Advice
  { category: 'Life Advice', emoji: '💪', label: 'Glow Up Guide', prompt: 'How {topic} will completely change your life' },
  { category: 'Life Advice', emoji: '🚀', label: 'Cheat Code', prompt: 'The cheat code for {topic} nobody is talking about' },
];

const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

const fillPrompt = (prompt: string, topic: string) => {
  const t = topic.trim();
  // Prevent mega-nesting if they click multiple templates
  if (t.includes('[YOUR TOPIC HERE]') || t.length > 60) {
    return prompt.replace('{topic}', '[YOUR TOPIC HERE]');
  }
  return t ? prompt.replace('{topic}', t) : prompt.replace('{topic}', '[YOUR TOPIC HERE]');
};

const CharacterDropdown: React.FC<{
    selectedName: string;
    options: Character[];
    onSelect: (name: string) => void;
}> = ({ selectedName, options, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-dodgerblue font-black uppercase tracking-widest text-[10px] hover:text-white transition-all py-1 px-2 rounded-lg hover:bg-white/5"
            >
                {selectedName}
                <svg className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-[#0F0F0F] border border-zinc-800 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {options.map((c) => (
                        <button
                            key={c.id}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dodgerblue/10 transition-colors text-left group ${selectedName === c.name ? 'bg-dodgerblue/5' : ''}`}
                            onClick={() => {
                                onSelect(c.name);
                                setIsOpen(false);
                            }}
                        >
                            <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                                {c.imageUrl ? (
                                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-dodgerblue">{c.name.charAt(0)}</div>
                                )}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedName === c.name ? 'text-dodgerblue' : 'text-zinc-400 group-hover:text-white'}`}>
                                {c.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const StepScript: React.FC<Props> = ({
  selectedCharacters,
  script,
  onScriptGenerated,
  onDialogueUpdate,
  onVoiceoverResultUpdate,
  sessionId,
}) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingIndices, setGeneratingIndices] = useState<number[]>([]);
  const [error, setError] = useState('');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const topicInputRef = React.useRef<HTMLInputElement>(null);

  const reconstructVoiceoverResult = (dialogue: DialogueLine[]) => {
    if (dialogue.some(d => !d.audioUrl)) {
      onVoiceoverResultUpdate(null);
      return;
    }

    let currentTime = 0;
    const scenes = dialogue.map((d) => {
      const scene = {
        characterId: selectedCharacters.find(c => c.name === d.character)?.id || 'unknown',
        characterName: d.character,
        text: d.line,
        audioUrl: d.audioUrl!,
        start: currentTime,
        duration: d.duration || 0,
        imageUrl: `/public/characters/${d.character.toLowerCase()}.png`
      };
      currentTime += scene.duration;
      return scene;
    });

    onVoiceoverResultUpdate({
      sessionId: Date.now().toString(),
      totalDuration: currentTime,
      scenes,
      bgVideoUrl: "/public/assets/subway_surfer.mp4"
    });
  };

  const generateLineVoiceover = async (index: number) => {
    if (!script) return;
    const line = script.dialogue[index];
    if (!line.line.trim()) return;

    setGeneratingIndices(prev => [...prev, index]);
    try {
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: line.line, 
          reference_id: line.referenceId,
          sessionId,
          lineIndex: index
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      
      const updatedDialogue = [...script.dialogue];
      updatedDialogue[index] = { 
        ...line, 
        audioUrl: data.url, 
        duration: data.duration 
      };
      onDialogueUpdate(updatedDialogue);
      reconstructVoiceoverResult(updatedDialogue);
    } catch (e: any) {
      console.error(`Voiceover failed for line ${index + 1}:`, e);
      setError(`Failed to generate voiceover for line ${index + 1}: ${e.message}`);
    } finally {
      setGeneratingIndices(prev => prev.filter(i => i !== index));
    }
  };

  const generateAllVoiceovers = async () => {
    if (!script) return;
    setLoading(true);
    setError('');
    
    try {
      // Filter for lines that don't have audio yet
      const dialogueToGenerate = script.dialogue.map((d, i) => ({ ...d, originalIndex: i }))
        .filter(d => !d.audioUrl);

      if (dialogueToGenerate.length === 0) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/voice/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dialogue: dialogueToGenerate,
          sessionId
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.json().catch(() => ({}));
        throw new Error(errorText.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      const result: VoiceoverResult = data.data;
      
      const updatedDialogue = [...script.dialogue];
      dialogueToGenerate.forEach((d, i) => {
        updatedDialogue[d.originalIndex] = {
          ...script.dialogue[d.originalIndex],
          audioUrl: result.scenes[i].audioUrl,
          duration: result.scenes[i].duration
        };
      });
      
      onDialogueUpdate(updatedDialogue);
      reconstructVoiceoverResult(updatedDialogue);
    } catch (e: any) {
      console.error('Bulk generation failed:', e);
      setError(e.message || 'Failed to generate missing voiceovers');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (url: string, index: number) => {
    if (audioRef.current) audioRef.current.pause();
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

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, characters: selectedCharacters.map(c => c.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: any = await res.json();
      if (data.warning && data.raw) {
        console.error("LLM Raw Output:", data.raw);
        throw new Error(`LLM parsing failed: ${data.warning}. Check console for raw output.`);
      }
      if (!data.dialogue || !Array.isArray(data.dialogue)) {
        console.error("Invalid Script Format:", data);
        throw new Error('LLM returned an invalid script format. Check console.');
      }
      onScriptGenerated(data as Script);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualStart = () => {
    onScriptGenerated({
      title: 'Custom Script',
      dialogue: [
        {
          character: selectedCharacters[0]?.name || 'Character',
          line: '',
          referenceId: selectedCharacters[0]?.referenceId,
        }
      ]
    });
  };

  const updateLine = (index: number, newLine: string) => {
    if (!script) return;
    const updated = script.dialogue.map((d, i) =>
      i === index ? { ...d, line: newLine } : d
    );
    onDialogueUpdate(updated);
  };

  const updateCharacter = (index: number, charName: string) => {
    if (!script) return;
    const char = selectedCharacters.find(c => c.name === charName);
    const updated = script.dialogue.map((d, i) =>
      i === index ? { ...d, character: charName, referenceId: char?.referenceId, audioUrl: null, duration: null } : d
    );
    onDialogueUpdate(updated);
    onVoiceoverResultUpdate(null);
  };

  const addLine = () => {
    if (!script) return;
    const lastChar = script.dialogue[script.dialogue.length - 1]?.character;
    // Switch to another character if possible
    const nextChar = selectedCharacters.find(c => c.name !== lastChar) || selectedCharacters[0];
    
    const newLine: DialogueLine = {
      character: nextChar?.name || 'Character',
      line: '',
      referenceId: nextChar?.referenceId,
    };
    onDialogueUpdate([...script.dialogue, newLine]);
  };

  const deleteLine = (index: number) => {
    if (!script) return;
    if (script.dialogue.length <= 1) return;
    const updated = script.dialogue.filter((_, i) => i !== index);
    onDialogueUpdate(updated);
  };

  return (
    <div className="bg-[#050505] border border-zinc-900 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-white mb-2">
          2. Script Composition
        </h2>
        <p className="text-zinc-500 text-sm">
          Generate with AI for chaos, or write it manually for precision.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 text-sm mb-6">
          ⚠ {error}
        </div>
      )}

      {!script && (
        <div className="animate-in fade-in zoom-in-95 duration-500">

          {/* ── Template Picker Toggle ── */}
          <div className="mb-6 flex justify-between items-center">
            <label htmlFor="topic-input" className="block text-[10px] uppercase tracking-widest text-zinc-500 font-black">
              Content Strategy / URL
            </label>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-[9px] uppercase tracking-widest font-black text-dodgerblue hover:text-white transition-colors px-3 py-1.5 bg-dodgerblue/10 hover:bg-dodgerblue/20 rounded-lg flex items-center gap-2"
            >
              {showTemplates ? 'Hide Templates' : '💡 Show Templates'}
            </button>
          </div>

          {/* ── Template Picker Content ── */}
          {showTemplates && (
            <div className="mb-8 animate-in slide-in-from-top-4 fade-in duration-300">
              {/* Character context — always visible so user knows who is in the prompt */}
              <div className="flex items-center gap-2 mb-4 p-3 bg-dodgerblue/5 border border-dodgerblue/15 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Featuring:</span>
                {selectedCharacters.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-2.5 py-1">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="w-4 h-4 rounded-full object-contain" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-dodgerblue flex items-center justify-center text-[7px] font-black text-black">{c.name.charAt(0)}</div>
                    )}
                    <span className="text-[9px] font-black text-dodgerblue uppercase tracking-wide">{c.name}</span>
                  </div>
                ))}
                <span className="text-[9px] text-zinc-700 font-black ml-auto">sent to AI →</span>
              </div>

              {/* Category filter */}
              <div className="flex gap-2 flex-wrap mb-4">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      activeCategory === cat
                        ? 'bg-dodgerblue text-black shadow-[0_0_15px_rgba(48,128,255,0.3)]'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Template chips */}
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES
                  .filter(t => activeCategory === 'All' || t.category === activeCategory)
                  .map((template, i) => {
                    const charNames = selectedCharacters.map(c => c.name);
                    const previewWithChars = template.prompt
                      .replace('{topic}', '…')
                      + (charNames.length ? ` — as ${charNames.join(' & ')}` : '');
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const filled = fillPrompt(template.prompt, topic);
                          setTopic(filled);
                          setTimeout(() => {
                            if (topicInputRef.current) {
                              topicInputRef.current.focus();
                              if (!topic.trim()) {
                                const start = filled.indexOf('[YOUR TOPIC HERE]');
                                if (start !== -1) {
                                  topicInputRef.current.setSelectionRange(start, start + '[YOUR TOPIC HERE]'.length);
                                }
                              }
                            }
                          }, 50);
                        }}
                        className="group flex items-start gap-3 p-3 bg-[#0A0A0A] border border-zinc-900 rounded-xl hover:border-dodgerblue/40 hover:bg-dodgerblue/5 transition-all text-left"
                      >
                        <span className="text-base shrink-0 mt-0.5">{template.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-dodgerblue transition-colors truncate">{template.label}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed line-clamp-2">{previewWithChars}</p>
                        </div>
                      </button>
                    );
                  })
                }
              </div>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="topic-input" className="block text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-3">
              Content Strategy / URL
            </label>
            <div className="relative group">
              <input
                id="topic-input"
                ref={topicInputRef}
                className="w-full bg-[#0A0A0A] border border-zinc-900 rounded-xl px-5 py-4 text-white placeholder:text-zinc-700 outline-none transition-all focus:border-dodgerblue focus:ring-4 focus:ring-dodgerblue/10 group-hover:border-zinc-800"
                type="text"
                placeholder='e.g. "Quantum Computing explained by viral characters"'
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                disabled={loading}
              />
              {topic && (
                <button
                  onClick={() => setTopic('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors text-xs font-black"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              className="bg-dodgerblue disabled:bg-zinc-900 disabled:text-zinc-600 text-black font-black uppercase tracking-widest text-[11px] py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_20px_rgba(48,128,255,0.3)] disabled:shadow-none flex items-center justify-center gap-2"
              disabled={!topic.trim() || loading}
              onClick={handleGenerate}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <span>🧠 AI Generate</span>
              )}
            </button>
            <button
              className="bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 font-black uppercase tracking-widest text-[11px] py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleManualStart}
              disabled={loading}
            >
              ✍ Write Manually
            </button>
          </div>
        </div>
      )}

      {script && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-black mb-1">Editing Draft</span>
               <h3 className="text-lg font-black text-white italic">"{script.title}"</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-[10px] uppercase tracking-widest font-black text-zinc-600 hover:text-zinc-400 transition-colors px-3 py-1.5 border border-zinc-900 hover:border-zinc-800 rounded-lg"
                onClick={() => {
                  setTopic('');
                  onScriptGenerated(null);
                }}
              >
                New Topic
              </button>
              <button
                className={`text-[10px] uppercase tracking-widest font-black transition-colors px-3 py-1.5 border rounded-lg flex items-center gap-1.5 ${
                  confirmClear 
                    ? 'text-red-400 border-red-500/50 bg-red-500/10' 
                    : 'text-red-500/70 hover:text-red-400 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5'
                }`}
                onClick={() => {
                  if (confirmClear) {
                    onDialogueUpdate([{
                      character: selectedCharacters[0]?.name || 'Character',
                      line: '',
                      referenceId: selectedCharacters[0]?.referenceId,
                    }]);
                    onVoiceoverResultUpdate(null);
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 3000); // reset after 3s
                  }
                }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {confirmClear ? "Click to confirm" : "Clear Script"}
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {script.dialogue.map((d, i) => (
              <div key={i} className="flex flex-col p-5 bg-[#0A0A0A] border border-zinc-900 rounded-2xl group hover:border-zinc-800 transition-colors relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const char = selectedCharacters.find(c => c.name === d.character);
                      return (
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-black text-dodgerblue text-xs overflow-hidden shadow-lg">
                          {char?.imageUrl ? (
                            <img src={char.imageUrl} alt={d.character} className="w-[85%] h-[85%] object-contain" />
                          ) : (
                            d.character.charAt(0)
                          )}
                        </div>
                      );
                    })()}
                    
                    <CharacterDropdown 
                        selectedName={d.character}
                        options={selectedCharacters}
                        onSelect={(name) => updateCharacter(i, name)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {d.audioUrl && (
                      <button
                        onClick={() => playAudio(d.audioUrl!, i)}
                        className={`p-2 rounded-lg transition-all ${playingIndex === i ? 'bg-dodgerblue text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                      >
                        {playingIndex === i ? '⏸' : '▶'}
                      </button>
                    )}
                    <button
                      onClick={() => generateLineVoiceover(i)}
                      disabled={generatingIndices.includes(i) || !d.line.trim()}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest ${
                        generatingIndices.includes(i) 
                          ? 'bg-zinc-900 animate-pulse text-zinc-500' 
                          : d.audioUrl 
                            ? 'bg-zinc-900 text-zinc-600 hover:text-dodgerblue hover:bg-dodgerblue/5' 
                            : 'bg-dodgerblue text-black shadow-lg shadow-dodgerblue/20 hover:scale-105'
                      }`}
                    >
                      {generatingIndices.includes(i) ? (
                         <div className="w-3 h-3 border-2 border-dodgerblue/30 border-t-dodgerblue rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                      <span>{d.audioUrl ? "Regenerate" : "Generate Audio"}</span>
                    </button>
                    <button 
                      onClick={() => deleteLine(i)}
                      className="text-zinc-700 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 rounded-lg"
                      title="Delete line"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <textarea
                  className="w-full bg-[#050505] border border-zinc-900 rounded-xl px-5 py-4 text-zinc-300 text-sm leading-relaxed outline-none resize-none focus:text-white focus:border-dodgerblue/30 focus:ring-4 focus:ring-dodgerblue/5 transition-all"
                  value={d.line}
                  onChange={(e) => {
                    updateLine(i, e.target.value);
                    // Clear audio if text changes
                    const updated = [...script.dialogue];
                    updated[i] = { ...updated[i], line: e.target.value, audioUrl: null, duration: null };
                    onDialogueUpdate(updated);
                    onVoiceoverResultUpdate(null);
                  }}
                  rows={2}
                  placeholder="Type what they say..."
                />
              </div>
            ))}

            <div className="flex gap-4">
              <button
                onClick={addLine}
                className="flex-1 py-4 border-2 border-dashed border-zinc-900 rounded-2xl text-zinc-600 hover:text-dodgerblue hover:border-dodgerblue/30 hover:bg-dodgerblue/5 transition-all text-[10px] uppercase tracking-widest font-black flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Line
              </button>
              
              <button
                onClick={generateAllVoiceovers}
                disabled={loading || script.dialogue.length === 0 || script.dialogue.every(d => !!d.audioUrl) || script.dialogue.some(d => !d.line.trim())}
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:border-dodgerblue/50 text-zinc-400 hover:text-dodgerblue rounded-2xl transition-all text-[10px] uppercase tracking-widest font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-dodgerblue/30 border-t-dodgerblue rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={script.dialogue.every(d => !!d.audioUrl) ? "M5 13l4 4L19 7" : "M13 10V3L4 14h7v7l9-11h-7z"} />
                    </svg>
                    {script.dialogue.every(d => !!d.audioUrl) ? "All Audio Ready" : "Generate All Audio"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepScript;
