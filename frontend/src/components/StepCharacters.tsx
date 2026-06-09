import React from 'react';
import type { Character } from '../types';

interface Props {
  characters: Character[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}

const StepCharacters: React.FC<Props> = ({ characters, selectedIds, onToggle }) => {
  const loading = false; // Now handled by App.tsx
  const error = '';

  return (
    <div className="bg-[#050505] border border-zinc-900 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-white mb-2">1. Pick Your Characters</h2>
        <p className="text-zinc-500 text-sm">Select at least 2 characters to start the dialogue.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 text-sm mb-6">
          ⚠ Failed to load characters: {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-zinc-900 border-t-dodgerblue rounded-full animate-spin" />
          <span className="text-zinc-500 font-medium">Loading characters…</span>
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <div className="text-4xl mb-4">🎭</div>
          <p>No characters found. Add characters via the API first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {characters.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <div
                key={c.id}
                className={`group relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-500 text-center overflow-hidden ${
                  isSelected
                    ? 'bg-dodgerblue/5 border-dodgerblue shadow-[0_0_30px_rgba(48,128,255,0.1)]'
                    : 'bg-[#0A0A0A] border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900/50 hover:translate-y-[-4px]'
                }`}
                onClick={() => onToggle(c.id)}
              >
                {/* Subtle Background Glow */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-b from-dodgerblue/10 to-transparent pointer-events-none" />
                )}
                
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-dodgerblue rounded-full flex items-center justify-center text-[12px] text-black font-black shadow-lg shadow-dodgerblue/20 z-10 animate-in zoom-in duration-300">
                    ✓
                  </div>
                )}
                
                <div
                  className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-black mx-auto mb-5 transition-all duration-500 border-2 shadow-2xl relative z-10 ${
                    isSelected ? 'bg-zinc-800 border-dodgerblue scale-110 shadow-dodgerblue/10' : 'bg-zinc-900 border-zinc-800 text-zinc-500 group-hover:border-zinc-600'
                  }`}
                >
                  {c.imageUrl ? (
                    <img 
                      src={c.imageUrl} 
                      alt={c.name} 
                      className="w-[85%] h-[85%] object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<span>${c.name.charAt(0)}</span>`;
                      }}
                    />
                  ) : (
                    c.name.charAt(0)
                  )}
                </div>
                
                <div className={`font-black text-xs uppercase tracking-tighter mb-1 relative z-10 transition-colors duration-300 ${isSelected ? 'text-dodgerblue' : 'text-white'}`}>
                  {c.name}
                </div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-black relative z-10">
                  {c.category}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {selectedIds.length < 2 && (
        <div className="mt-8 p-4 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
           Please select at least 2 characters to unlock the next section
        </div>
      )}
    </div>
  );
};

export default StepCharacters;
