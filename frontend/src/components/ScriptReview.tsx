import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Header } from './Header';
import { ArrowRight, Check, Clapperboard, RefreshCcw, Edit2 } from 'lucide-react';

export default function ScriptReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const state = location.state as { scripts?: any[], brandContext?: any, selectedCharacter?: any, product?: any } | null;

  const [scripts, setScripts] = useState<any[]>(state?.scripts || []);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  
  const { selectedCharacter, product } = state || {};

  if (!state || !state.scripts || scripts.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4">No Scripts Found</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-white text-black rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  // Group scripts by hook
  const groupedScripts = scripts.reduce((acc: any, script: any) => {
    if (!acc[script.hook]) acc[script.hook] = [];
    acc[script.hook].push(script);
    return acc;
  }, {});

  const handleCreateVideo = async () => {
    if (!selectedScriptId) return;

    const selectedScript = scripts.find(s => s.id === selectedScriptId);
    if (!selectedScript) return;

    // Create a new project seeded with this script
    try {
      const token = localStorage.getItem('reelswarm-jwt') || localStorage.getItem('brainrot-jwt');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: 'Marketing Video', 
          emoji: '🎬', 
          style: 'product-hook' 
        }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();

      // Create the scenes structure expected by the editor
      const formattedScript = {
        title: selectedScript.hook,
        scenes: selectedScript.scenes || []
      };

      const projectState = {
        ...project,
        state: {
          campaignId: selectedScript.campaignId,
          productId: selectedScript.productId,
          scriptGenerationId: selectedScript.id,
          script: formattedScript,
          selectedCharacterIds: []
        }
      };

      // Since the App routing doesn't automatically inject this into the editor
      // We will save this state to the project, then navigate to /projects or /editor.
      // For now, we will pass it via navigate state if needed, or rely on App.tsx loadProjectState.
      // Easiest is to navigate to hub and tell it to open the project, but we can't easily trigger loadProjectState from here without passing it.
      // Wait, we can navigate to /editor but we don't have setActiveProject here.
      // Let's just update the project via API and then navigate to /projects where the user can open it.
      
      await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state: projectState.state }),
      });

      // Quickest way to load it is just to go to /projects
      navigate('/projects');
    } catch (error) {
      console.error(error);
      alert("Failed to create video project.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/30 font-sans pb-32">
      <Header type="landing" onGoToLanding={() => navigate('/')} />

      <main className="pt-32 px-6 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold uppercase tracking-widest mb-2">
            Script Review
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Select Best Script</h1>
          <p className="text-xl text-zinc-400 font-medium max-w-2xl mx-auto">
            Review the generated marketing scripts for your selected hooks and pick the winner.
          </p>
        </div>

        <div className="space-y-12">
          {Object.entries(groupedScripts).map(([hook, hookScripts]: [string, any], idx) => (
            <div key={idx} className="space-y-6">
              <div className="p-6 rounded-2xl bg-dodgerblue/5 border border-dodgerblue/20">
                <h2 className="text-xl font-bold text-dodgerblue mb-2">Hook</h2>
                <p className="text-lg font-medium">"{hook}"</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 max-w-2xl mx-auto gap-6">
                {hookScripts.map((script: any) => {
                  const isSelected = selectedScriptId === script.id;
                  return (
                    <div 
                      key={script.id}
                      onClick={() => setSelectedScriptId(script.id)}
                      className={`relative flex flex-col p-8 rounded-3xl border cursor-pointer transition-all duration-300 ${
                        isSelected 
                          ? 'border-dodgerblue shadow-[0_0_30px_rgba(30,144,255,0.2)] bg-dodgerblue/5' 
                          : 'border-white/[0.08] bg-[#0a0a0a] hover:border-white/20 hover:bg-[#111]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <span className="px-4 py-1.5 bg-white/10 text-xs font-bold uppercase tracking-widest rounded-full flex items-center gap-2">
                          <Clapperboard className="w-4 h-4" /> {script.templateType || 'Story'} Variation
                        </span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-dodgerblue border-dodgerblue text-white' : 'border-zinc-600 bg-black'
                        }`}>
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                      </div>

                      <div className="flex-1 space-y-4 mb-6">
                        {(script.scenes || []).map((scene: any, sceneIdx: number) => (
                          <div key={sceneIdx} className="bg-black/30 rounded-xl border border-white/5 p-4 space-y-3">
                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center justify-between">
                              <span>Scene {sceneIdx + 1}</span>
                              <span>{scene.durationSeconds}s</span>
                            </div>
                            
                            {scene.onScreenText && (
                              <div>
                                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-1">On-Screen Text</div>
                                <div className="text-sm font-medium text-white bg-white/5 p-3 rounded-lg border border-white/10 text-center">
                                  "{scene.onScreenText}"
                                </div>
                              </div>
                            )}

                            {scene.videoPrompt && (
                              <div className="relative">
                                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-1">AI Video Prompt</div>
                                <div className="text-sm text-purple-300 italic bg-purple-500/10 p-5 rounded-xl border border-purple-500/20 leading-relaxed">
                                  <span className="relative z-10">🎥 {scene.videoPrompt}</span>
                                  
                                  {/* Inject the thumbnails here */}
                                  {(scene.featuresCharacter || scene.featuresProduct) && (
                                    <div className="mt-5 flex items-start gap-4 border-t border-purple-500/20 pt-5">
                                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-6">Target Assets:</span>
                                      <div className="flex gap-4">
                                        {scene.featuresCharacter && selectedCharacter && (
                                          <div className="flex flex-col items-center gap-2">
                                            <div className="w-20 h-20 rounded-xl border border-purple-500/50 overflow-hidden bg-zinc-900 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:scale-110 transition-transform cursor-pointer">
                                              <img src={selectedCharacter.imageUrl} alt="Character" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] text-purple-300 font-bold tracking-wider">{selectedCharacter.name}</span>
                                          </div>
                                        )}
                                        {scene.featuresProduct && product && product.imageUrls && product.imageUrls.length > 0 && (
                                          <div className="flex flex-col items-center gap-2">
                                            <div className="w-20 h-20 rounded-xl border border-purple-500/50 overflow-hidden bg-zinc-900 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:scale-110 transition-transform cursor-pointer">
                                              <img src={`/api/proxy/image?url=${encodeURIComponent(product.imageUrls[0].startsWith('//') ? `https:${product.imageUrls[0]}` : product.imageUrls[0])}`} alt="Product" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] text-purple-300 font-bold tracking-wider">Product</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-white/10">
                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Call to Action</div>
                        <div className="text-sm font-medium text-amber-400">{script.cta}</div>
                      </div>

                      {/* Hover actions (Mocked for now) */}
                      <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                        <button className="p-2 bg-black/50 hover:bg-white/20 rounded-lg text-white backdrop-blur-sm" title="Edit Script">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-black/50 hover:bg-white/20 rounded-lg text-white backdrop-blur-sm" title="Regenerate">
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-lg">
              {selectedScriptId ? '1 Script Selected' : '0 Scripts Selected'}
            </div>
            <div className="text-zinc-400 text-sm">Select the best script to continue to the editor</div>
          </div>
          <button 
            onClick={handleCreateVideo}
            disabled={!selectedScriptId}
            className={`px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all ${
              selectedScriptId
                ? 'bg-white text-black hover:bg-zinc-200 hover:scale-105' 
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            Create Video <Clapperboard className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
