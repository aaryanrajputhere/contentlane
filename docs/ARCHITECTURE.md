# System Architecture: Brainrot Studio

## Overview
Brainrot Studio is a full-stack application that enables users to generate "brainrot" style videos using AI-generated scripts, synthesized voices, and dynamic visual overlays.

## Components

### 1. Frontend (React + Vite)
- **Framework**: React 18 with TypeScript.
- **Rendering Engine**: [Remotion](https://www.remotion.dev/) for frame-by-frame video synthesis in the browser.
- **Communication**: Interacts with the backend via REST API.
- **Key Modules**:
    - `StudioMonitor`: The primary workspace for visual positioning and previewing.
    - `ScriptEditor`: Interface for AI script generation and audio synthesis.
    - `AssetManager`: Handles character images and background videos.

### 2. Backend (Node.js + Express)
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL with Prisma ORM.
- **API Endpoints**:
    - `/api/auth`: User registration and login.
    - `/api/scripts`: Script generation logic.
    - `/api/voice`: Synthesis of audio clips.
    - `/api/characters`: Metadata and assets for video characters.
    - `/api/video`: Video project management.

### 3. Video Rendering Pipeline
- **Browser-Based**: Rendering occurs primarily on the client side using `@remotion/web-renderer`.
- **Audio Synthesis**: Backend fetches audio from external TTS APIs and serves them via `/public` assets.
- **Composition**: Assets (background, characters, subtitles) are layered in real-time within the Remotion `Composition`.

## Data Model (Prisma)
- **User**: Stores authentication and profile data.
- **Character**: Metadata for visual assets including `referenceId`, `description`, and `tags`.
- **Project/Video**: (Planned) To store script state, asset positions, and rendering configurations.

## Security & Performance
- **Cross-Origin Isolation**: Necessary for shared array buffers and high-performance video rendering.
- **Stateless Auth**: (Planned) JWT-based authentication.
- **Asset Caching**: Background videos and audio clips are served with appropriate headers for browser caching.
