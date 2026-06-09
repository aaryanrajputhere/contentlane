import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Header } from './Header';
import { ArrowRight, Check, Zap } from 'lucide-react';

export default function HookStrategy() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const state = location.state as { brandContext: any, selectedProductId?: string, selectedCharacter?: any, products?: any[] } | null;

  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!state || !state.brandContext || !state.brandContext.hooks) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4">No Hooks Found</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-white text-black rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  const { brandContext, selectedProductId, selectedCharacter, products } = state;
  const hooksData = brandContext.hooks;

  const toggleHook = (hookText: string) => {
    setSelectedHook(prev => prev === hookText ? null : hookText);
  };

  const handleGenerateScripts = async () => {
    if (!selectedHook || !selectedProductId || isGenerating) return;
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/scripts/generate-marketing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: id,
          productId: selectedProductId,
          hooks: [selectedHook],
          character: selectedCharacter ? selectedCharacter.name : null
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate scripts');
      
      const data = await response.json();
      navigate(`/campaign/${id}/scripts`, { 
        state: { 
          scripts: data, 
          brandContext,
          selectedCharacter,
          product: products?.find((p: any) => p.id === selectedProductId)
        } 
      });
    } catch (error) {
      console.error(error);
      alert("Failed to generate scripts. Check console for details.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/30 font-sans pb-32">
      <Header type="landing" onGoToLanding={() => navigate('/')} />

      <main className="pt-32 px-6 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">
            Step 3: Hook Strategy
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Pick Your Winning Hook</h1>
          <p className="text-xl text-zinc-400 font-medium max-w-2xl mx-auto">
            Select the <span className="text-white font-bold">single best hook</span> below. We will generate 3 full script variations based on your choice.
          </p>
        </div>

        <div className="space-y-12">
          {Object.entries(hooksData).map(([category, hooksArray]: [string, any]) => {
            if (!Array.isArray(hooksArray) || hooksArray.length === 0) return null;
            return (
              <div key={category} className="space-y-4">
                <h2 className="text-2xl font-bold capitalize flex items-center gap-3 text-dodgerblue">
                  <Zap className="w-6 h-6" /> {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hooksArray.map((hookObj, idx) => {
                    const isSelected = selectedHook === hookObj.text;
                    const hasSelection = selectedHook !== null;
                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleHook(hookObj.text)}
                        className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${
                          isSelected 
                            ? 'bg-dodgerblue/10 border-dodgerblue shadow-[0_0_30px_rgba(30,144,255,0.3)] scale-[1.02] ring-2 ring-dodgerblue/50' 
                            : hasSelection 
                              ? 'bg-[#050505] border-white/[0.03] opacity-40 hover:opacity-100 hover:border-white/10' 
                              : 'bg-[#0a0a0a] border-white/[0.08] hover:border-white/20 hover:-translate-y-1'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className={`font-semibold text-lg leading-snug ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                            {hookObj.text}
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                            isSelected ? 'bg-dodgerblue border-dodgerblue text-white' : 'border-zinc-700 bg-black/50'
                          }`}>
                            {isSelected && <Check className="w-4 h-4" />}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs font-medium">
                          <span className="text-zinc-500 uppercase tracking-widest">Score: {hookObj.score}/10</span>
                          {hookObj.score >= 9 && <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">🔥 High Viral Potential</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-lg">{selectedHook ? '1 Hook Selected' : '0 Hooks Selected'}</div>
            <div className="text-zinc-400 text-sm">Select one winning hook to generate script variations</div>
          </div>
          <button 
            onClick={handleGenerateScripts}
            disabled={!selectedHook || isGenerating}
            className={`px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all ${
              selectedHook && !isGenerating
                ? 'bg-white text-black hover:bg-zinc-200 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]' 
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>Generating Scripts... <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full ml-2"></div></>
            ) : (
              <>Generate Scripts <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
