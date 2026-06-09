# Brainrot Studio — Features & Use Cases

> The elite suite for AI-generated "brainrot" educational videos. Turn any topic into a viral short-form clip with AI scripts, cloned voices, and real-time visual editing — all from the browser.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Core Features](#core-features)
3. [Intended Use Cases](#intended-use-cases)
4. [User Workflow](#user-workflow)
5. [API Surface](#api-surface)
6. [External Integrations](#external-integrations)
7. [Technical Capabilities](#technical-capabilities)
8. [Planned / Roadmap](#planned--roadmap)

---

## Product Overview

Brainrot Studio is a full-stack video creation platform that automates the production of "brainrot"-style educational short-form content. These videos are characterized by:

- **Split-screen format** — engaging background gameplay (e.g. Subway Surfers) with overlaid dialogue.
- **Dynamic subtitles** — word-by-word highlighting synced to AI-generated voiceovers.
- **Character-driven dialogue** — recognizable characters (Rick, Morty, etc.) debating and explaining topics in a chaotic, high-retention style.

The entire pipeline — from topic input to exported MP4 — runs in one session without leaving the browser.

---

## Core Features

### 1. Authentication & Session Management

| Capability | Details |
|---|---|
| **Email/Password Signup** | Create an account with name, email, and password. Passwords are hashed with `bcrypt`. |
| **Email/Password Login** | Authenticate and receive a JWT (7-day expiry). |
| **Persistent Sessions** | JWT and user data stored in `localStorage`; sessions survive page refreshes. |
| **Session Reset** | One-click "Reset" clears all local state, JWT, and user data. |

### 2. Character Selection

| Capability | Details |
|---|---|
| **Character Gallery** | Visual grid of all available characters fetched from the database (`/api/characters`). |
| **Toggle Selection** | Click to select/deselect characters. Minimum of **2 required** to proceed. |
| **Character Metadata** | Each character carries a `name`, `category`, `description`, `tags`, `referenceId` (voice model), and optional `imageUrl`. |
| **Visual Feedback** | Selected characters show a glowing blue border, gradient overlay, and animated checkmark. |
| **CRUD via API** | Characters can be created, read, updated, and deleted through REST endpoints. |

### 3. AI Script Generation

| Capability | Details |
|---|---|
| **Topic-Based Generation** | Enter any topic (e.g. "Quantum Computing") and the AI generates a full multi-character dialogue script. |
| **LLM Engine** | Powered by **Meta Llama 3.1 70B Instruct** via Hugging Face Inference API. |
| **Structured Output** | LLM returns strict JSON with `title` and `dialogue[]` — each line includes `character`, `line`, and emotion tags. |
| **Emotion Tags** | Every line includes `[soft]`, `[excited]`, `[laughing]`, `[pause]`, etc. for expressive TTS synthesis. |
| **Story Structure** | Scripts follow a mandatory 6-beat arc: Hook → Chaos → Conflict → Overload → Clarity → Loopable Ending. |
| **Manual Script Mode** | Skip AI entirely and write the script line-by-line from scratch. |
| **Inline Editing** | After generation, every line is editable — change text, swap characters, add/delete lines. |
| **Character Reassignment** | Dropdown on each line lets you reassign which character speaks it (clears audio to force re-synthesis). |

### 4. AI Voice Synthesis (TTS)

| Capability | Details |
|---|---|
| **Per-Line Generation** | Generate voiceover for any single dialogue line independently. |
| **Bulk Generation** | "Generate All Audio" processes only lines **missing audio** — already-generated clips are skipped. |
| **Voice Cloning** | Uses **Fish Audio TTS API** with character-specific `referenceId` for voice cloning fidelity. |
| **Audio Preview** | Play/pause any generated clip inline with a single click. |
| **Auto-Invalidation** | Editing a line's text automatically clears its audio, requiring re-generation. |
| **Duration Tracking** | Exact audio duration (in seconds) is measured server-side via `get-audio-duration` after each synthesis. |
| **Session-Based Storage** | Audio files are stored on disk under `/public/voiceovers/{sessionId}/line_{index}.mp3`. |

### 5. Real-Time Video Preview (Studio Monitor)

| Capability | Details |
|---|---|
| **Live Remotion Player** | The right-side panel renders a real-time `@remotion/player` preview at 720×1280 (9:16 portrait). |
| **Background Video** | Looping, muted gameplay footage fills the background. |
| **Character Overlay** | PNG character images are composited with spring-physics entrance animations. |
| **Karaoke Subtitles** | Words are displayed in chunks of 4, with the currently-spoken word highlighted in a configurable active color. |
| **Audio Sync** | Each scene's audio plays in sequence, precisely aligned to frame-based timing. |

### 6. Interactive Drag-and-Drop Positioning

| Capability | Details |
|---|---|
| **Subtitle Crosshair** | Drag anywhere on the preview to reposition the subtitle X/Y anchor. A dashed crosshair visualizes the position. |
| **Character Drag** | Drag the character ghost overlay to reposition the actor on the canvas. |
| **Hit-Test Selection** | The system auto-detects whether you clicked on the actor bounding box or the subtitle area — no toggle buttons needed. |
| **Ghost Overlays** | Semi-transparent dashed outlines show exact character and subtitle positions in real-time. |
| **60fps Dragging** | Drag interactions use `requestAnimationFrame` for jank-free updates. |

### 7. Style Customization Panel

| Capability | Details |
|---|---|
| **Subtitle Font Size** | Slider from 40px to 160px. |
| **Active Word Color** | 5 preset colors (Yellow, Cyan, Magenta, Green, White) for the currently-spoken word. |
| **Inactive Word Color** | 5 preset colors for non-active words. |
| **Character Scale** | Slider from 10% to 100% of frame height. |
| **Character X/Y Position** | Independent sliders for horizontal and vertical placement. |

### 8. In-Browser Video Export

| Capability | Details |
|---|---|
| **Client-Side Rendering** | Uses `@remotion/web-renderer` (`renderMediaOnWeb`) — rendering happens entirely in the user's browser. |
| **Hardware Acceleration** | Leverages browser GPU and multi-threading for fast encodes. |
| **Progress Indicator** | Animated radial progress bar shows render completion percentage. |
| **Blob Download** | Rendered video is output as a `Blob`, converted to a local URL for instant MP4 download. |
| **Retry** | If something goes wrong, hit "Retry" to re-render without leaving the page. |

### 9. State Persistence

| Capability | Details |
|---|---|
| **Auto-Save** | All editor state (character selection, script, voiceover data, style settings) is debounced-saved to `localStorage` every 1 second. |
| **Auto-Restore** | On page load, the entire session is hydrated from `localStorage` — you pick up right where you left off. |
| **Blob URL Exclusion** | Video blob URLs are intentionally **not** persisted (they die with the browser tab). |

### 10. Landing Page

| Capability | Details |
|---|---|
| **Hero Section** | Bold headline, animated badge ("v2.0 Now Live"), and hero image with parallax glow effect. |
| **Feature Cards** | Three cards highlighting AI Script Engine, Voice Clone Sync, and Client-Side Render. |
| **CTA Section** | Gradient glassmorphism call-to-action with "Get Started for Free" button. |
| **Navigation** | Top nav with Features/Showcase anchors and Login button. |
| **Footer** | Branding, copyright, and social links (Twitter, Discord). |

---

## Intended Use Cases

### Primary

| Use Case | Description |
|---|---|
| **Educational Brainrot** | Turn any academic or technical topic into a viral, retention-optimized short-form video. Perfect for TikTok, YouTube Shorts, and Instagram Reels. |
| **Content Creator Workflow** | Creators who want fast, character-driven explainer videos without hiring voice actors or video editors. |
| **Meme-Format Education** | Teachers, tutors, and edtech creators who want to make learning feel "accidental" through chaotic but clear dialogue. |

### Secondary

| Use Case | Description |
|---|---|
| **Marketing Clips** | Generate attention-grabbing product explainers in the brainrot aesthetic. |
| **Rapid Prototyping** | Test video concepts in minutes — swap characters, rewrite lines, re-render — without any external tools. |
| **Voice Clone Demos** | Experiment with Fish Audio voice models by generating single-line audio clips with different characters. |

---

## User Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. LANDING PAGE                                    │
│     → "Get Started" → Auth (Login / Signup)         │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  2. CHARACTER SELECTION                             │
│     → Pick 2+ characters from the gallery           │
│     → Unlocks Script section                        │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  3. SCRIPT COMPOSITION                              │
│     → Enter topic → AI Generate (or Write Manually) │
│     → Edit lines, swap characters, add/remove lines │
│     → Generate voiceover per-line or in bulk        │
│     → Preview audio clips inline                    │
│     → All audio ready → Export section unlocks      │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  4. POLISH & EXPORT                                 │
│     → Customize subtitle style (size, colors)       │
│     → Adjust character position and scale           │
│     → Drag elements on the Studio Monitor preview   │
│     → Hit "Export Final Brainrot (MP4)"             │
│     → Wait for in-browser render → Download MP4     │
└─────────────────────────────────────────────────────┘
```

---

## API Surface

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate and receive JWT |

### Characters
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/characters` | List all characters |
| `GET` | `/api/characters/:id` | Get a single character |
| `POST` | `/api/characters` | Create a new character |
| `PUT` | `/api/characters/:id` | Update a character |
| `DELETE` | `/api/characters/:id` | Delete a character |

### Scripts
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scripts/generate` | Generate an AI script from a topic + character IDs |

### Voice Synthesis
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/voice/generate` | Generate audio for a single dialogue line |
| `POST` | `/api/voice/generate-script` | Bulk-generate audio for all missing lines in a script |

### Video (Server-Side — Legacy)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/video/render` | Trigger a server-side Remotion render (legacy, replaced by client-side rendering) |

---

## External Integrations

| Service | Purpose | Details |
|---|---|---|
| **Hugging Face Inference API** | LLM script generation | Model: `meta-llama/Llama-3.1-70B-Instruct:fastest`. Used via OpenAI-compatible client. |
| **Fish Audio TTS API** | Voice synthesis & cloning | Per-character voice models referenced by `referenceId`. Outputs MP3 with normalized audio. |
| **PostgreSQL** | Persistent data store | Stores `User` and `Character` models via Prisma ORM. |

---

## Technical Capabilities

| Capability | Implementation |
|---|---|
| **Client-Side Rendering** | `@remotion/web-renderer` — no server required for final video export. |
| **Frame-Accurate Timing** | Audio durations measured with `get-audio-duration`; scenes positioned with frame-level precision at 24fps. |
| **Spring Physics** | Character entrance animations use Remotion's `spring()` for natural motion. |
| **Karaoke Subtitles** | Word-by-word highlighting with 4-word chunks, auto-advancing based on frame/duration ratio. |
| **Cross-Origin Isolation** | `COOP: same-origin` + `COEP: require-corp` headers for `SharedArrayBuffer` support (required by Remotion). |
| **Debounced Persistence** | Editor state saved to `localStorage` with a 1-second debounce to avoid excessive writes. |
| **60fps Drag System** | Mouse/touch interactions routed through `requestAnimationFrame` with hit-test-based target detection. |

---

## Planned / Roadmap

| Feature | Status | Notes |
|---|---|---|
| **Project Persistence (DB)** | 🔲 Planned | Save full project state (script, positions, assets) to the database instead of localStorage only. |
| **Multiple Background Videos** | 🔲 Planned | Let users choose from a library of background gameplay clips. |
| **Custom Voice Upload** | 🔲 Planned | Upload your own voice sample for Fish Audio voice cloning. |
| **Template System** | 🔲 Planned | Pre-built script templates for common formats (debate, explainer, quiz). |
| **Export Quality Settings** | 🔲 Planned | Let users choose resolution (720p/1080p/4K) and bitrate before rendering. |
| **Collaborative Editing** | 🔲 Planned | Multi-user real-time editing via WebSockets. |
| **Analytics Dashboard** | 🔲 Planned | Track render counts, popular topics, and usage metrics per user. |
