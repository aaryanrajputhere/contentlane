import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BrandProfile } from '../types/domain';
import { brandProfileValidationError } from '../lib/brand-profile-confirmation.mjs';

export type BrandProfileConfirmation = Pick<
  BrandProfile,
  'brandName' | 'productSummary' | 'targetAudience' | 'customerProblems' | 'keyBenefits' | 'proofPoints' | 'claimConstraints'
>;

type Props = {
  profile: BrandProfile;
  busy: boolean;
  error: string;
  onConfirm: (profile: BrandProfileConfirmation) => Promise<void>;
};

const fieldClass = 'mt-2 w-full rounded-2xl border border-black/10 bg-[#fafaf8] px-4 py-3 text-sm leading-6 text-[#111] outline-none transition placeholder:text-[#aaa] focus:border-black/30 focus:ring-4 focus:ring-black/5';

function lines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export default function BrandProfileConfirmationModal({ profile, busy, error, onConfirm }: Props) {
  const [draft, setDraft] = useState<BrandProfileConfirmation>(() => ({
    brandName: profile.brandName,
    productSummary: profile.productSummary,
    targetAudience: profile.targetAudience,
    customerProblems: profile.customerProblems,
    keyBenefits: profile.keyBenefits,
    proofPoints: profile.proofPoints,
    claimConstraints: profile.claimConstraints,
  }));
  const [advanced, setAdvanced] = useState(false);
  const [validationError, setValidationError] = useState('');

  const updateList = (key: 'customerProblems' | 'keyBenefits' | 'proofPoints' | 'claimConstraints', value: string) => {
    setDraft((current) => ({ ...current, [key]: lines(value) }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError('');
    const invalid = brandProfileValidationError(draft);
    if (invalid) {
      setValidationError(invalid);
      return;
    }
    await onConfirm({
      ...draft,
      brandName: draft.brandName.trim(),
      productSummary: draft.productSummary.trim(),
      targetAudience: draft.targetAudience.trim(),
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[77px] z-[70] overflow-y-auto bg-[#eeeDE8]/95 px-4 py-6 backdrop-blur-xl sm:px-6 sm:py-10" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="brand-confirmation-title" className="mx-auto w-full max-w-5xl overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-[0_34px_100px_rgba(0,0,0,0.16)]">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="relative overflow-hidden bg-[#151515] p-7 text-white sm:p-9">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full border-[34px] border-[#b8f36b]/15" aria-hidden="true" />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8f36b]">Brand checkpoint</p>
            <h1 id="brand-confirmation-title" className="relative mt-6 text-4xl font-black leading-[0.96] tracking-[-0.06em] sm:text-5xl">We found your brand.</h1>
            <p className="relative mt-5 max-w-sm text-sm leading-7 text-white/65">Review the source of truth before ContentLane writes your first hooks. Your edits shape every idea that follows.</p>
            <div className="relative mt-9 rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Analyzed website</p>
              <p className="mt-2 break-words text-lg font-bold">{profile.brandName}</p>
            </div>
          </aside>

          <form onSubmit={(event) => void submit(event)} className="p-6 sm:p-9">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold sm:col-span-2">Brand name
                <input className={fieldClass} value={draft.brandName} onChange={(event) => setDraft({ ...draft, brandName: event.target.value })} autoFocus />
              </label>
              <label className="block text-sm font-bold sm:col-span-2">What does your product do?
                <textarea className={fieldClass} rows={3} value={draft.productSummary} onChange={(event) => setDraft({ ...draft, productSummary: event.target.value })} />
              </label>
              <label className="block text-sm font-bold sm:col-span-2">Who is it for?
                <textarea className={fieldClass} rows={2} value={draft.targetAudience} onChange={(event) => setDraft({ ...draft, targetAudience: event.target.value })} />
              </label>
              <label className="block text-sm font-bold">Customer problems <span className="font-medium text-[#888]">· one per line</span>
                <textarea className={fieldClass} rows={4} value={draft.customerProblems.join('\n')} onChange={(event) => updateList('customerProblems', event.target.value)} />
              </label>
              <label className="block text-sm font-bold">Key benefits <span className="font-medium text-[#888]">· one per line</span>
                <textarea className={fieldClass} rows={4} value={draft.keyBenefits.join('\n')} onChange={(event) => updateList('keyBenefits', event.target.value)} />
              </label>
            </div>

            <div className="mt-6 rounded-[22px] border border-black/8 bg-[#fafaf8] p-4">
              <button type="button" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced} className="flex w-full items-center justify-between gap-4 text-left">
                <span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#888]">Optional context</span><span className="mt-1 block text-sm font-bold">Proof and claim guardrails</span></span>
                <ChevronDown size={18} className={`shrink-0 transition-transform motion-reduce:transition-none ${advanced ? 'rotate-180' : ''}`} />
              </button>
              {advanced ? (
                <div className="mt-4 grid gap-4 border-t border-black/8 pt-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold">Proof points <span className="font-medium text-[#888]">· one per line</span>
                    <textarea className={fieldClass} rows={3} value={draft.proofPoints.join('\n')} onChange={(event) => updateList('proofPoints', event.target.value)} />
                  </label>
                  <label className="block text-sm font-bold">Claim constraints <span className="font-medium text-[#888]">· one per line</span>
                    <textarea className={fieldClass} rows={3} value={draft.claimConstraints.join('\n')} onChange={(event) => updateList('claimConstraints', event.target.value)} />
                  </label>
                </div>
              ) : null}
            </div>

            {validationError || error ? <p role="alert" className="mt-5 text-sm font-semibold text-red-700">{validationError || error}</p> : null}
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-black/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#777]">You can edit this again from the campaign workspace after subscribing.</p>
              <button type="submit" disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#111] px-6 py-3.5 text-sm font-black text-white shadow-[0_12px_26px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55">
                {busy ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={17} />}
                {busy ? 'Saving brand…' : 'Confirm brand & generate hooks'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
