// ──────────────────────────────────────────────
// Types shared across the frontend
// ──────────────────────────────────────────────

export interface Character {
  id: string;
  name: string;
  referenceId: string;
  description: string;
  tags: string[];
  category: string;
  imageUrl?: string;
}

export interface DialogueLine {
  character: string;
  line: string;
  referenceId?: string | null;
  audioUrl?: string | null;
  duration?: number | null;
}

export interface Script {
  title: string;
  dialogue: DialogueLine[];
}

export interface SceneMetadata {
  characterId: string;
  characterName: string;
  text: string;
  audioUrl: string;
  start: number;
  duration: number;
  imageUrl: string;
}

export interface VoiceoverResult {
  sessionId: string;
  totalDuration: number;
  scenes: SceneMetadata[];
  bgVideoUrl: string;
}

export interface ProjectState {
  selectedCharacterIds: string[];
  script: Script | null;
  voiceoverResult: VoiceoverResult | null;
  sessionId: string | null;
  subtitleFontSize: number;
  subtitleX: number;
  subtitleY: number;
  activeColor: string;
  inactiveColor: string;
  characterX: number;
  characterY: number;
  characterScale: number;
  bgVideoUrl: string;
  videoSpeed?: number;
}

export type VideoStyle = 'product-hook' | 'storytime' | 'debate' | 'newsflash' | 'lecture';

export interface Project {
  id: string;
  name: string;
  emoji: string;
  style: VideoStyle;
  state?: ProjectState;
  createdAt: string;
  updatedAt: string;
}
