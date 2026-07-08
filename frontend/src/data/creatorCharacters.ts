import type { CreatorCharacter } from '../types/domain';

export interface CustomCharacterDraft {
  name: string;
  persona: string;
  appearance: string;
  voice: string;
}

export const creatorCharacters = [
  {
    id: 'creator-alix-founder',
    source: 'preset',
    name: 'Alix Founder',
    persona: 'Direct founder energy, sharp and concise on camera.',
    appearance: 'Black tee, clean studio lighting, neutral background, minimal jewelry.',
    voice: 'Confident, practical, fast-paced, no filler.',
    prompt: 'A direct founder-led creator with sharp delivery, editorial framing, and a premium clean look.',
  },
  {
    id: 'creator-nova-operator',
    source: 'preset',
    name: 'Nova Operator',
    persona: 'Calm operator persona that makes product complexity feel simple.',
    appearance: 'Soft charcoal wardrobe, laptop or tablet in hand, calm set design.',
    voice: 'Measured, technical, reassuring, focused on outcomes.',
    prompt: 'A polished operator-style creator with clean composition, low-key confidence, and product-first framing.',
  },
  {
    id: 'creator-theo-educator',
    source: 'preset',
    name: 'Theo Educator',
    persona: 'Warm educator who explains the value in one breath.',
    appearance: 'Light neutral shirt, bright natural light, tidy desk, approachable framing.',
    voice: 'Warm, clear, helpful, slightly upbeat.',
    prompt: 'A creator-teacher with approachable energy, clear gestures, and a refined social video aesthetic.',
  },
  {
    id: 'creator-mira-critic',
    source: 'preset',
    name: 'Mira Critic',
    persona: 'Opinionated reviewer with a taste for sharper hooks and contrast.',
    appearance: 'Tailored jacket, high contrast lighting, editorial close-up framing.',
    voice: 'Crisp, skeptical, punchy, very hook-driven.',
    prompt: 'A critic-style creator with bold framing, expressive delivery, and premium editorial contrast.',
  },
  {
    id: 'creator-jules-maker',
    source: 'preset',
    name: 'Jules Maker',
    persona: 'Hands-on maker who shows the product, not just the pitch.',
    appearance: 'Minimal workwear, desk setup, tools and product on set, tactile details.',
    voice: 'Grounded, practical, builder-minded, with clean pacing.',
    prompt: 'A maker-creator with tactile product demo energy, calm confidence, and a premium workshop feel.',
  },
] satisfies CreatorCharacter[];

export const defaultCustomCharacterDraft: CustomCharacterDraft = {
  name: 'Your Creator',
  persona: 'Founder-led, brand-native creator who matches the hook.',
  appearance: 'Clean wardrobe, minimal set, camera-ready and modern.',
  voice: 'Clear, concise, confident, and easy to follow.',
};

export function buildCustomCharacterPrompt(draft: CustomCharacterDraft) {
  return [
    `Character: ${draft.name}.`,
    `Persona: ${draft.persona}.`,
    `Appearance: ${draft.appearance}.`,
    `Voice: ${draft.voice}.`,
    'Keep the look premium, creator-led, and tailored to the hook.',
  ].join(' ');
}
