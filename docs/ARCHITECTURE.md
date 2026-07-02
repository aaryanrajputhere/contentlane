# ReelSwarm Architecture

## Frontend

The React/Vite SPA implements this route flow:

```text
/ → /campaign/:id/brand-profile → /campaign/:id/hooks
  → /campaign/:id/scripts → /editor
```

Campaign data is passed between workflow pages through router state. `EditorPage` previews generated scene videos and exports the assembled result with Canvas, Web Audio, and MediaRecorder.

## Backend

Express exposes REST endpoints for:

- `/api/auth`: signup and login.
- `/api/campaigns`: website analysis, persisted brand context, products, and hooks.
- `/api/scripts`: marketing-script generation and retrieval.
- `/api/images`: image upload plus RunPod image/video generation.
- `/api/creators`: optional marketing spokesperson assets.
- `/api/proxy`: cross-origin image loading for the browser editor.

## Data and integrations

PostgreSQL is accessed through Prisma. The retained models are `User`, `Campaign`, `BrandContext`, `Product`, `ScriptGeneration`, and `Creator`.

External integrations are Firecrawl, Hugging Face inference, RunPod, and Cloudinary. Generated media is stored in Cloudinary rather than in the repository.
