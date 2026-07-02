# ReelSwarm Features

- Website crawling and product discovery with Firecrawl.
- AI-generated brand positioning, audience, benefits, objections, and content angles.
- Product-specific hook generation and scoring.
- Visual short-form script generation with scene prompts and on-screen text.
- Optional creator/spokesperson selection for generated scenes.
- RunPod image generation from creator and product references.
- RunPod image-to-video generation.
- Cloudinary image and video storage.
- Browser-based scene preview, text styling, music mixing, and WebM export.
- PostgreSQL persistence for campaigns, products, brand context, scripts, creators, and users.

## API surface

- `POST /api/campaigns/analyze`
- `GET /api/campaigns/:id`
- `POST /api/campaigns/:id/generate-hooks`
- `POST /api/scripts/generate-marketing`
- `GET /api/scripts/:campaignId`
- `DELETE /api/scripts/:id`
- `POST /api/images/generate`
- `POST /api/images/generate-videos`
- `POST /api/images/upload`
- `GET|POST /api/creators`
- `POST /api/auth/signup`
- `POST /api/auth/login`
