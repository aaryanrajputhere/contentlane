import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, CheckCircle2, Link as LinkIcon, BrainCircuit, Target, Clapperboard, Clock, TrendingUp, Coins, Star, Layers, Check, Loader2 } from 'lucide-react';
import { Header } from './Header';
import { useNavigate } from 'react-router-dom';

interface Props {
  onGetStarted: () => void;
  user?: any;
}

const LandingPage: React.FC<Props> = ({ onGetStarted, user }) => {
  const [urlInput, setUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const navigate = useNavigate();

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-50px" },
    transition: { duration: 0.6, ease: "easeOut" as const }
  };

  const handleAnalyze = async () => {
    if (!urlInput) {
      onGetStarted();
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep(1); // Discovering pages

    try {
      // Simulate intermediate steps since API is long-polling
      const steps = [
        { step: 1, delay: 0 },
        { step: 2, delay: 3000 }, // Extracting products
        { step: 3, delay: 8000 }, // Understanding audience
        { step: 4, delay: 15000 }, // Identifying benefits
        { step: 5, delay: 20000 }, // Building brand profile
      ];

      const timeouts = steps.map(s => setTimeout(() => setAnalysisStep(s.step), s.delay));

      const res = await fetch('/api/campaigns/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: urlInput, forceRegenerate })
      });

      timeouts.forEach(clearTimeout);

      if (res.ok) {
        setAnalysisStep(5);
        const data = await res.json();
        setTimeout(() => {
          navigate(`/campaign/${data.campaignId}/brand-profile`, {
            state: { brandContext: data.brandContext, products: data.products, totalProductsFound: data.totalProductsFound }
          });
        }, 1000);
      } else {
        alert("Failed to analyze website");
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error(error);
      alert("Error occurred during analysis");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/30 font-sans overflow-x-hidden">
      {/* SECTION 1: NAVBAR */}
      <Header 
        type="landing"
        user={user}
        onGetStarted={onGetStarted}
        onGoToLanding={() => {}}
      />

      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col gap-32">
        
        {/* SECTION 2: HERO */}
        <section className="flex flex-col items-center text-center relative z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />

          <motion.div {...fadeIn} className="relative px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center gap-2 mb-8 shadow-sm">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-300 uppercase">REELSWARM</span>
          </motion.div>

          <motion.h1 
            {...fadeIn} transition={{ delay: 0.1, duration: 0.6 }}
            className="relative text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 max-w-4xl"
          >
            Turn Your Website Into <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500">30 Days of Content</span>
          </motion.h1>

          <motion.p 
            {...fadeIn} transition={{ delay: 0.2, duration: 0.6 }}
            className="relative text-zinc-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed font-medium"
          >
            Paste your website URL and ReelSwarm automatically analyzes your brand, generates content ideas, writes scripts, and creates ready-to-post TikToks, Reels, and Shorts.
          </motion.p>

          <motion.div 
            {...fadeIn} transition={{ delay: 0.3, duration: 0.6 }}
            className="relative w-full max-w-2xl mx-auto flex flex-col items-center gap-6"
          >
            {/* Input Mockup */}
            <div className="w-full flex items-center bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-2 shadow-2xl focus-within:border-white/20 transition-colors">
              <div className="pl-4 pr-2 text-zinc-500">
                <LinkIcon size={20} />
              </div>
              <input 
                type="text" 
                placeholder="https://yourbrand.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600 font-medium py-3"
              />
              <button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                {isAnalyzing ? "Analyzing..." : "Generate Content"} {!isAnalyzing && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="w-full flex items-center gap-2 px-2">
              <input 
                type="checkbox" 
                id="forceRegenerate" 
                checked={forceRegenerate}
                onChange={(e) => setForceRegenerate(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-black text-dodgerblue focus:ring-dodgerblue focus:ring-offset-zinc-900"
              />
              <label htmlFor="forceRegenerate" className="text-sm text-zinc-400 font-medium cursor-pointer hover:text-zinc-300 transition-colors">
                Force re-analysis (ignore cached results)
              </label>
            </div>
            
            {isAnalyzing && (
              <div className="w-full mt-4 space-y-2 p-4 bg-zinc-900/50 rounded-xl border border-white/[0.05]">
                 <div className="flex items-center gap-3 text-sm">
                   <div className="w-5 h-5 flex items-center justify-center">
                     {analysisStep > 1 ? <CheckCircle2 className="text-green-500 w-4 h-4" /> : <Loader2 className="animate-spin text-dodgerblue w-4 h-4" />}
                   </div>
                   <span className={analysisStep >= 1 ? "text-white" : "text-zinc-500"}>Discovering pages</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm">
                   <div className="w-5 h-5 flex items-center justify-center">
                     {analysisStep > 2 ? <CheckCircle2 className="text-green-500 w-4 h-4" /> : analysisStep === 2 ? <Loader2 className="animate-spin text-dodgerblue w-4 h-4" /> : null}
                   </div>
                   <span className={analysisStep >= 2 ? "text-white" : "text-zinc-500"}>Extracting products</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm">
                   <div className="w-5 h-5 flex items-center justify-center">
                     {analysisStep > 3 ? <CheckCircle2 className="text-green-500 w-4 h-4" /> : analysisStep === 3 ? <Loader2 className="animate-spin text-dodgerblue w-4 h-4" /> : null}
                   </div>
                   <span className={analysisStep >= 3 ? "text-white" : "text-zinc-500"}>Understanding audience</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm">
                   <div className="w-5 h-5 flex items-center justify-center">
                     {analysisStep > 4 ? <CheckCircle2 className="text-green-500 w-4 h-4" /> : analysisStep === 4 ? <Loader2 className="animate-spin text-dodgerblue w-4 h-4" /> : null}
                   </div>
                   <span className={analysisStep >= 4 ? "text-white" : "text-zinc-500"}>Identifying benefits</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm">
                   <div className="w-5 h-5 flex items-center justify-center">
                     {analysisStep > 5 ? <CheckCircle2 className="text-green-500 w-4 h-4" /> : analysisStep === 5 ? <Loader2 className="animate-spin text-dodgerblue w-4 h-4" /> : null}
                   </div>
                   <span className={analysisStep >= 5 ? "text-white" : "text-zinc-500"}>Building brand profile</span>
                 </div>
              </div>
            )}

            <button className="text-sm font-medium text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
              <Play className="w-4 h-4" /> Watch Demo
            </button>
          </motion.div>

          {/* Hero Visual Pipeline */}
          <motion.div 
            {...fadeIn} transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-20 w-full max-w-5xl relative"
          >
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm font-semibold text-zinc-500 uppercase tracking-widest">
              <div className="flex items-center gap-3 bg-white/[0.02] px-6 py-4 rounded-2xl border border-white/[0.05]">
                <LinkIcon size={18} className="text-white" /> Website
              </div>
              <ArrowRight size={16} className="hidden md:block opacity-30" />
              <div className="flex items-center gap-3 bg-white/[0.02] px-6 py-4 rounded-2xl border border-white/[0.05]">
                <BrainCircuit size={18} className="text-white" /> AI Analysis
              </div>
              <ArrowRight size={16} className="hidden md:block opacity-30" />
              <div className="flex items-center gap-3 bg-white/[0.02] px-6 py-4 rounded-2xl border border-white/[0.05]">
                <Target size={18} className="text-white" /> Content Ideas
              </div>
              <ArrowRight size={16} className="hidden md:block opacity-30" />
              <div className="flex items-center gap-3 bg-white/[0.02] px-6 py-4 rounded-2xl border border-white/[0.05]">
                <Clapperboard size={18} className="text-white" /> Videos
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 3: CONTENT ANGLE GENERATION */}
        <section id="features" className="relative z-10 pt-10">
          <motion.div {...fadeIn} className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Your Website Already Contains Great Content</h2>
              <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                We don't just generate random videos. Our AI crawls your site, extracts your unique value propositions, and transforms them into high-converting, viral-ready content angles.
              </p>
            </div>
            
            <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] pointer-events-none" />
              <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <LinkIcon size={16} /> Website: <span className="text-white lowercase">glowdrop.com</span>
              </div>
              
              <div className="space-y-4">
                {[
                  "Why your water gets warm after 2 hours",
                  "The gym mistake most people make",
                  "Cheap bottle vs premium bottle",
                  "POV: hydration finally solved",
                  "The hydration hack nobody talks about"
                ].map((angle, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i }}
                    key={i} 
                    className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl"
                  >
                    <CheckCircle2 size={18} className="text-blue-400 shrink-0" />
                    <span className="font-medium text-zinc-200">{angle}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 4: HOW IT WORKS */}
        <section className="relative z-10 text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-16">From Website To Viral Content</h2>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-y-1/2 z-0" />
            
            {[
              { icon: <LinkIcon size={24} />, title: "Paste URL", desc: "Just drop your website link." },
              { icon: <BrainCircuit size={24} />, title: "AI Analyzes", desc: "We read your product pages." },
              { icon: <Target size={24} />, title: "Content Angles", desc: "Generate viral strategies." },
              { icon: <Clapperboard size={24} />, title: "Create Videos", desc: "Rendered automatically." }
            ].map((step, i) => (
              <motion.div 
                {...fadeIn} transition={{ delay: 0.1 * i }}
                key={i} 
                className="relative z-10 bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 bg-white/[0.05] border border-white/[0.1] rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg">
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-zinc-500 font-medium">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 5: TEMPLATE LIBRARY */}
        <section id="templates" className="relative z-10">
          <motion.div {...fadeIn} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Proven Formats That Stop The Scroll</h2>
            <p className="text-zinc-400 font-medium max-w-2xl mx-auto">We've codified the highest performing TikTok and Reels formats into scalable templates.</p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { name: "Mess vs Masterpiece", useCase: "Product Hook", color: "from-blue-500/20 to-transparent", video: "/assets/landing/demo1.mp4" },
              { name: "Podcast Debate", useCase: "SaaS Explainer", color: "from-purple-500/20 to-transparent", video: "/assets/landing/demo2.mp4" },
              { name: "Problem → Solution", useCase: "E-Commerce", color: "from-green-500/20 to-transparent", video: "/assets/landing/demo3.mp4" },
              { name: "POV Story", useCase: "Brand Awareness", color: "from-orange-500/20 to-transparent", video: "/assets/landing/demo1.mp4" }
            ].map((template, i) => (
              <motion.div 
                {...fadeIn} transition={{ delay: 0.1 * i }}
                key={i} 
                className="group relative aspect-[9/16] rounded-3xl bg-[#0a0a0a] border border-white/[0.08] overflow-hidden flex flex-col justify-end p-6 hover:border-white/20 transition-all cursor-pointer"
              >
                <video autoPlay loop muted playsInline src={template.video} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                <div className={`absolute inset-0 bg-gradient-to-t ${template.color} z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-20">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{template.useCase}</div>
                  <h3 className="text-lg font-bold leading-tight">{template.name}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 6: VIDEO SHOWCASE */}
        <section className="relative z-10 py-16 border-y border-white/[0.05]">
          <motion.div {...fadeIn} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Content Generated By ReelSwarm</h2>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {["/assets/landing/demo1.mp4", "/assets/landing/demo2.mp4", "/assets/landing/demo3.mp4"].map((video, i) => (
              <motion.div 
                {...fadeIn} transition={{ delay: 0.1 * i }}
                key={i} 
                className="relative w-full max-w-[280px] aspect-[9/16] rounded-[2.5rem] bg-black border-[6px] border-zinc-900 shadow-2xl overflow-hidden shrink-0"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-5 bg-zinc-900 rounded-b-xl z-20" />
                <video autoPlay loop muted playsInline src={video} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 7: BENEFITS */}
        <section className="relative z-10">
          <motion.div {...fadeIn} className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Why Teams Use ReelSwarm</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: <Clock />, title: "Save Time", subtitle: "Generate Weeks Of Content", desc: "Stop spending 10 hours a week editing. Get a month's worth of videos in 5 minutes." },
              { icon: <TrendingUp />, title: "Scale Faster", subtitle: "Produce Content At Scale", desc: "A/B test dozens of angles simultaneously instead of betting on just one video." },
              { icon: <Coins />, title: "Reduce Costs", subtitle: "Replace Expensive Agencies", desc: "Get agency-quality social content at a fraction of the traditional cost." },
              { icon: <Layers />, title: "Stay Consistent", subtitle: "Never Run Out Of Ideas", desc: "Our AI ensures you always have high-quality concepts ready to publish." }
            ].map((benefit, i) => (
              <motion.div 
                {...fadeIn} transition={{ delay: 0.1 * i }}
                key={i} 
                className="bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl"
              >
                <div className="w-12 h-12 bg-white/[0.05] rounded-2xl flex items-center justify-center mb-6 text-white">
                  {benefit.icon}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{benefit.subtitle}</div>
                <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 8: SOCIAL PROOF */}
        <section className="relative z-10 text-center">
          <motion.div {...fadeIn} className="mb-12">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Built For Modern Brands</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((_, i) => (
              <motion.div 
                {...fadeIn} transition={{ delay: 0.1 * i }}
                key={i} 
                className="bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl text-left"
              >
                <div className="flex gap-1 text-yellow-500 mb-4">
                  {[1,2,3,4,5].map(s => <Star key={s} size={16} fill="currentColor" />)}
                </div>
                <p className="text-zinc-300 font-medium leading-relaxed mb-6">"This tool entirely replaced our TikTok agency. We just paste our product links and get videos that actually convert."</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div>
                    <div className="font-bold text-sm">Sarah Jenkins</div>
                    <div className="text-xs text-zinc-500">Founder, E-Commerce Brand</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SECTION 9: PRICING */}
        <section id="pricing" className="relative z-10 pt-10">
          <motion.div {...fadeIn} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Simple Pricing</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
            {/* Starter */}
            <motion.div {...fadeIn} className="bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="text-3xl font-bold mb-6">$29<span className="text-lg text-zinc-500 font-medium">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {['30 Videos/month', 'Basic Templates', 'Standard Voices'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300 font-medium">
                    <Check size={16} className="text-zinc-500" /> {feature}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] font-bold transition-colors">Start Free</button>
            </motion.div>

            {/* Pro */}
            <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="bg-[#0f0f0f] border-2 border-white/20 p-8 rounded-3xl relative transform md:-translate-y-4 shadow-2xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Most Popular</div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-6">$79<span className="text-lg text-zinc-500 font-medium">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {['100 Videos/month', 'Premium Templates', 'AI Voice Cloning', 'Watermark Removed'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white font-medium">
                    <Check size={16} className="text-white" /> {feature}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-3 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold transition-colors">Upgrade to Pro</button>
            </motion.div>

            {/* Business */}
            <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="bg-[#0a0a0a] border border-white/[0.08] p-8 rounded-3xl">
              <h3 className="text-xl font-bold mb-2">Business</h3>
              <div className="text-3xl font-bold mb-6">$199<span className="text-lg text-zinc-500 font-medium">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {['Unlimited Videos', 'Custom Templates', 'API Access', 'Priority Support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300 font-medium">
                    <Check size={16} className="text-zinc-500" /> {feature}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] font-bold transition-colors">Contact Sales</button>
            </motion.div>
          </div>
        </section>

        {/* SECTION 10: FINAL CTA */}
        <section className="relative z-10 pb-20">
          <motion.div {...fadeIn} className="bg-gradient-to-b from-[#111] to-[#0a0a0a] border border-white/[0.08] rounded-[3rem] p-12 md:p-20 text-center flex flex-col items-center">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Ready To Turn Your Website Into Content?</h2>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-10 font-medium">
              Paste your URL and generate your first videos in minutes.
            </p>
            
            <div className="w-full max-w-xl flex flex-col sm:flex-row items-center bg-black border border-white/[0.1] rounded-2xl p-2 focus-within:border-white/30 transition-colors">
              <div className="pl-4 pr-2 text-zinc-500 hidden sm:block">
                <LinkIcon size={20} />
              </div>
              <input 
                type="text" 
                placeholder="https://yourbrand.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600 font-medium py-3 px-4 sm:px-0 w-full"
              />
              <button 
                onClick={onGetStarted} 
                className="w-full sm:w-auto px-8 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-all whitespace-nowrap mt-2 sm:mt-0"
              >
                Start Generating
              </button>
            </div>
          </motion.div>
        </section>

      </main>

      {/* SECTION 11: FOOTER */}
      <footer className="border-t border-white/[0.05] bg-[#020202] pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2">
            <div className="text-xl font-bold tracking-tighter mb-4">
              REEL<span className="text-zinc-500">SWARM</span>
            </div>
            <p className="text-zinc-500 text-sm max-w-xs font-medium">
              The AI content engine for modern brands. Turn any URL into high-performing short-form video.
            </p>
          </div>
          
          <div>
            <div className="font-bold mb-4">Product</div>
            <ul className="space-y-3 text-sm text-zinc-500 font-medium">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Templates</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
            </ul>
          </div>

          <div>
            <div className="font-bold mb-4">Company</div>
            <ul className="space-y-3 text-sm text-zinc-500 font-medium">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <div className="font-bold mb-4">Legal</div>
            <ul className="space-y-3 text-sm text-zinc-500 font-medium">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-600 text-[10px] font-bold tracking-widest uppercase">
          <div>© 2026 ReelSwarm. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-zinc-400 transition-colors">Twitter</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
