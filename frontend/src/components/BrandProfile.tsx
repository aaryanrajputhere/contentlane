import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Target, Heart, Zap, Package, ArrowRight, Check } from 'lucide-react';

export default function BrandProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { brandContext: any, products: any[], totalProductsFound?: number } | null;

  if (!state || !state.brandContext) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4">No Brand Data Found</h2>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-white text-black rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  const { brandContext, products, totalProductsFound } = state;
  
  const audienceTags = (brandContext.targetAudience || []).slice(0, 6);
  const whyPeopleBuy = [
    ...(brandContext.benefits || []),
    ...(brandContext.customerDesires || []),
    ...(brandContext.emotionalTriggers || [])
  ].slice(0, 6);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const CHARACTERS = [
    {
      id: 'casual_creator',
      name: 'Casual Creator',
      description: 'A young, energetic TikTok-style content creator.',
      imageUrl: '/@fs/home/aaryan-rajput/.gemini/antigravity/brain/c9a99754-7390-4de1-a729-49f105e83cf9/casual_creator_1780949688012.png'
    },
    {
      id: 'professional_expert',
      name: 'Professional Expert',
      description: 'A confident business expert in a modern office.',
      imageUrl: '/@fs/home/aaryan-rajput/.gemini/antigravity/brain/c9a99754-7390-4de1-a729-49f105e83cf9/professional_expert_1780949708526.png'
    },
    {
      id: 'energetic_gamer',
      name: 'Tech / Gamer',
      description: 'A high-energy reviewer with neon RGB lighting.',
      imageUrl: '/@fs/home/aaryan-rajput/.gemini/antigravity/brain/c9a99754-7390-4de1-a729-49f105e83cf9/energetic_gamer_1780949721388.png'
    }
  ];

  const campaignId = brandContext.campaignId || location.pathname.split('/')[2];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/30 font-sans">
      <Header type="landing" onGoToLanding={() => navigate('/')} />

      <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto space-y-12">
        {/* Section 1: Brand Summary */}
        <div className="text-center space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-dodgerblue/10 border border-dodgerblue/20 text-dodgerblue text-xs font-bold uppercase tracking-widest mb-2">
            Brand Profile
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{brandContext.brandName}</h1>
          <p className="text-xl text-zinc-400 font-medium">{brandContext.productCategory}</p>
          {brandContext.productSummary && (
            <p className="text-lg text-zinc-500 max-w-2xl mx-auto mt-4 leading-relaxed">{brandContext.productSummary}</p>
          )}
        </div>

        {/* Section 2: Audience */}
        {audienceTags.length > 0 && (
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl">
            <div className="flex items-center gap-3 mb-6 text-xl font-bold">
              <Target className="text-dodgerblue" /> Audience
            </div>
            <div className="flex flex-wrap gap-2">
              {audienceTags.map((item: string, i: number) => (
                <span key={i} className="px-4 py-2 bg-dodgerblue/10 text-dodgerblue rounded-full text-sm font-medium border border-dodgerblue/20">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Why People Buy */}
        {whyPeopleBuy.length > 0 && (
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl">
            <div className="flex items-center gap-3 mb-6 text-xl font-bold">
              <Heart className="text-pink-500" /> Why Customers Love This Product
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {whyPeopleBuy.map((item: string, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-[#111] p-3 rounded-xl border border-white/[0.05]">
                  <Check className="text-green-500 w-5 h-5 shrink-0" />
                  <span className="text-zinc-200 font-medium text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Products Found */}
        {(products || []).length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Package className="text-white w-6 h-6" />
              <h2 className="text-2xl font-bold">Pick Target Product</h2>
            </div>
            <p className="text-zinc-400 mb-6 font-medium">Select the product you want to create videos for.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(products || []).map((p, i) => {
                const isSelected = selectedProductId === p.id;
                const imageUrl = p.imageUrls && p.imageUrls.length > 0 
                  ? `/api/proxy/image?url=${encodeURIComponent(p.imageUrls[0].startsWith('//') ? `https:${p.imageUrls[0]}` : p.imageUrls[0])}`
                  : null;
                  
                return (
                  <div 
                    key={p.id || i}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-200 group ${
                      isSelected 
                        ? 'border-dodgerblue shadow-[0_0_20px_rgba(30,144,255,0.2)] bg-dodgerblue/5' 
                        : 'bg-[#0a0a0a] border-white/[0.08] hover:border-white/20 hover:-translate-y-1'
                    }`}
                  >
                    {imageUrl ? (
                      <div className="w-full aspect-square rounded-t-2xl bg-zinc-900 overflow-hidden border-b border-white/[0.05]">
                        <img 
                          src={imageUrl} 
                          alt={p.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-t-2xl bg-zinc-900 flex items-center justify-center border-b border-white/[0.05]">
                        <Package className="text-zinc-700 w-12 h-12" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className={`font-bold text-lg leading-tight line-clamp-2 ${isSelected ? 'text-dodgerblue' : 'text-white'}`}>
                          {p.name}
                        </h3>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                          isSelected ? 'bg-dodgerblue border-dodgerblue text-white' : 'border-zinc-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2">{p.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4.5: Character Selection */}
        {selectedProductId && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-10 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 mb-6">
              <svg className="text-purple-500 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h2 className="text-2xl font-bold">Pick Your Spokesperson (Optional)</h2>
            </div>
            <p className="text-zinc-400 mb-6 font-medium">Select a character to represent your brand in the generated video scenes.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {CHARACTERS.map(character => {
                const isSelected = selectedCharacter?.id === character.id;
                return (
                  <div 
                    key={character.id}
                    onClick={() => setSelectedCharacter(isSelected ? null : character)}
                    className={`relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-300 group ${
                      isSelected 
                        ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.25)] bg-purple-500/10' 
                        : 'bg-[#0a0a0a] border-white/[0.08] hover:border-white/20 hover:-translate-y-1'
                    }`}
                  >
                    <div className="w-full aspect-square bg-zinc-900 overflow-hidden relative">
                      <img 
                        src={character.imageUrl} 
                        alt={character.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-bold text-lg ${isSelected ? 'text-purple-400' : 'text-white'}`}>
                          {character.name}
                        </h3>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'border-zinc-500 bg-black/50'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-2">{character.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 5: Choose Strategy (Appears after product selection) */}
        {selectedProductId && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-10 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-amber-500 w-6 h-6" />
              <h2 className="text-2xl font-bold">Select a Content Strategy</h2>
            </div>
            <p className="text-zinc-400 mb-6 font-medium">Choose a proven viral format, or let our AI generate custom hooks for your product.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                {
                  id: 'mess-vs-masterpiece',
                  title: 'The Mess v/s the Masterpiece',
                  description: 'Show a chaotic problem first, then introduce your product as the elegant, perfect solution.',
                  instructions: 'STRICT SCENE STRUCTURE REQUIRED:\n1. The first 2-3 scenes MUST have the exact onScreenText: "The Mess". The videoPrompt must show chaotic, messy, or frustrating shots of a character building or creating the product.\n2. The final 1-2 scenes MUST have the exact onScreenText: "The Masterpiece". The videoPrompt must show incredibly cool, cinematic, high-quality shots of the finalized product.',
                  icon: '🎭'
                },
                {
                  id: 'nobody-will-buy',
                  title: 'The Contrarian Angle',
                  description: '"Nobody is going to buy your [product]... would you use one?" Builds intrigue and defends value.',
                  icon: '🤔'
                },
                {
                  id: 'three-reasons',
                  title: 'The Value Stacker',
                  description: '"3 reasons why you need this before it sells out." High urgency, fast-paced, and feature-focused.',
                  icon: '🔥'
                }
              ].map(format => (
                <div 
                  key={format.id}
                  onClick={async () => {
                    if (isGenerating) return;
                    setIsGenerating(true);
                    try {
                      // Skip hook generation, go straight to script generation using the format as the hook
                      const hookPayload = format.instructions 
                        ? `Format: ${format.title}\n${format.instructions}`
                        : `Format: ${format.title}. Angle: ${format.description}`;

                      const response = await fetch(`/api/scripts/generate-marketing`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          campaignId: campaignId,
                          productId: selectedProductId,
                          hooks: [hookPayload],
                          character: selectedCharacter ? selectedCharacter.name : null
                        })
                      });
                      
                      if (!response.ok) throw new Error('Failed to generate scripts');
                      
                      const data = await response.json();
                      navigate(`/campaign/${campaignId}/scripts`, { 
                        state: { 
                          scripts: data, 
                          brandContext,
                          selectedCharacter,
                          product: products.find((p: any) => p.id === selectedProductId)
                        } 
                      });
                    } catch (error) {
                      console.error(error);
                      alert("Failed to generate scripts.");
                      setIsGenerating(false);
                    }
                  }}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 bg-[#0a0a0a] border-white/[0.08] hover:border-white/20 hover:-translate-y-1 hover:bg-[#111]`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{format.icon}</div>
                    <div>
                      <h3 className="font-bold text-lg text-white mb-1">{format.title}</h3>
                      <p className="text-sm text-zinc-400">{format.description}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div 
                onClick={async () => {
                  if (isGenerating) return;
                  setIsGenerating(true);
                  try {
                    const res = await fetch(`/api/campaigns/${campaignId}/generate-hooks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        productId: selectedProductId,
                        character: selectedCharacter ? selectedCharacter.name : null
                      })
                    });
                    if (!res.ok) throw new Error('Failed to generate hooks');
                    const data = await res.json();
                    
                    const updatedBrandContext = { ...brandContext, hooks: data.hooks };
                    navigate(`/campaign/${campaignId}/hooks`, { 
                      state: { 
                        brandContext: updatedBrandContext, 
                        products, 
                        selectedProductId,
                        selectedCharacter
                      } 
                    });
                  } catch (e) {
                    console.error(e);
                    alert('Failed to generate hooks.');
                    setIsGenerating(false);
                  }
                }}
                className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 bg-dodgerblue/5 border-dodgerblue/30 hover:border-dodgerblue hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(30,144,255,0.15)] flex flex-col justify-center items-center text-center group`}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-3 text-dodgerblue font-bold">
                    Working... <div className="animate-spin w-5 h-5 border-2 border-dodgerblue border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <>
                    <Zap className="text-dodgerblue w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold text-lg text-dodgerblue mb-1">Generate AI Hooks</h3>
                    <p className="text-sm text-dodgerblue/70">Let AI analyze your product and generate unique viral angles</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
