# Design System: Brainrot Studio

## Core Aesthetic
- **Vibe**: High-energy, chaotic yet polished, dark mode, high contrast.
- **Inspiration**: TikTok/Shorts trends, cyberpunk, gaming dashboards.

## Color Palette
- **Background**: `#000000` (Pitch Black)
- **Primary/Accent**: `#3080FF` (Dodger Blue)
- **Secondary**: Dark grays (`#111`, `#222`, `#333`)
- **Text**: `#FFFFFF` (White)
- **Subtext**: Gray-400/500

## Typography
- **Primary Font**: `Inter` (Sans-serif)
- **Weight**: Bold/Extra-Bold for headings and subtitles.

## Component Patterns0
- Sticky video preview on the right.
- Responsive container that maintains 9:16 aspect ratio.
- Ghost overlays for positioning elements.

### 2. Script Editor
- Line-by-line editing.
- Integration with Voiceover generation status.
- Bulk actions (Generate all, Clear all).

### 3. Subtitles
- Large, centered, high-contrast text.
- Dynamic animations (pop-in, scaling) synced with audio.

## UX Principles
- **Instant Feedback**: Preview should update as soon as the script or layout changes.
- **Gesture Support**: Hit-testing for moving characters and text instead of manual coordinate inputs.
- **Workflow-Centric**: Step-by-step navigation (Script -> Character -> Background -> Render).
