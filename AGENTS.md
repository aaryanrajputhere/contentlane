# Agent Context: ReelSwarm

## Project Overview

ReelSwarm is an AI-powered platform that turns a business website into short-form marketing videos.

## Active Workflow

```text
Website → Brand Profile → Hooks → Scripts → AI Images/Videos → EditorPage
```

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Browser editor: Canvas, Web Audio, and MediaRecorder.
- Backend: Node.js, Express, TypeScript.
- Database: PostgreSQL with Prisma ORM.
- AI and media: Hugging Face, Firecrawl, RunPod, and Cloudinary.
- Icons: Lucide React.

## Coding Standards

1. Use strict TypeScript and avoid `any` in new code.
2. Use functional React components and Hooks.
3. Keep long-running AI media operations outside frame/render loops.
4. Use `PascalCase` for components and `camelCase` for functions and variables.
5. Prefer Tailwind utility classes over custom CSS.
6. Preserve the active marketing workflow and avoid reintroducing the removed character-dialogue, voice-generation, project-editor, or Remotion systems.

## Priorities

- Visual impact for short-form marketing content.
- Smooth browser previews and exports.
- Efficient external API usage.
- Clear separation between campaign analysis, script generation, media generation, and editing.
