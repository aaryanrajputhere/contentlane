# Brainrot Studio: Pages & User Experience

This document outlines the core views within the Brainrot Studio platform, their corresponding routing states, and the intended user experience (UX) for each.

*Note: The application currently uses a Single Page Application (SPA) state-based router (e.g., `view === 'landing'`), but these correspond conceptually to the following URL paths.*

---

## 1. Landing Page
- **Conceptual URL:** `/`
- **Component:** `LandingPage.tsx`
- **User Experience:**
  This is the marketing storefront. The UX is designed to be high-energy, dark-mode, and visually arresting, immediately conveying the value proposition of "Content Generation at Scale." It features auto-playing background videos of actual generated content formatted as 9:16 reels. The primary goal is conversion, driving users to click "GENERATE NOW."

## 2. Authentication
- **Conceptual URL:** `/auth`
- **Component:** `AuthPage.tsx`
- **User Experience:**
  A sleek, split-screen login and signup flow. One side provides the authentication form, while the other reinforces the platform's value with high-quality visual assets or branding. The UX is frictionless, transitioning the user seamlessly into the application upon successful authentication.

## 3. Studio Hub (Templates Page)
- **Conceptual URL:** `/hub` or `/templates`
- **Component:** `StudioHub.tsx`
- **User Experience:**
  Acting as the bridge between authentication and creation, this page asks the user, "What are we creating today?" It presents a grid of video formats (Explainer, Story Time, Debate, etc.). The UX is highly interactive; hovering over a format reveals a dynamic video background demonstrating the exact type of content that format produces. This provides immediate visual context before the user commits to a template.

## 4. Projects Dashboard
- **Conceptual URL:** `/projects`
- **Component:** `ProjectsPage.tsx`
- **User Experience:**
  A clean, organized workspace where users can manage their active and completed video generations. It displays project metadata (name, style, last edited) in a grid format. The UX focuses on utility, allowing users to quickly jump back into an existing session or start a new project based on the style they just selected in the Studio Hub.

## 5. The Editor Workspace
- **Conceptual URL:** `/editor` or `/project/:id`
- **Component:** `App.tsx` (wrapping `StepCharacters`, `StepScript`, `StepRender`, and `PlayerComposition`)
- **User Experience:**
  This is the core engine of the application. The UX is divided into a **Step-by-Step Pipeline** on the left and a **Persistent Studio Monitor** on the right.
  - **Left Panel (Pipeline):** Users progress through logical steps: selecting AI characters, generating/editing scripts and voiceovers, and finalizing render settings.
  - **Right Panel (Monitor):** A live, 9:16 interactive video preview. As the user configures scripts or layouts on the left, the monitor updates in real-time. It features drag-and-drop ghost overlays, allowing users to physically reposition characters and text on the video canvas before rendering, ensuring a perfect "what-you-see-is-what-you-get" (WYSIWYG) experience.
