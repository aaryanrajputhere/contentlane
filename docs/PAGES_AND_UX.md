# ReelSwarm Pages and Workflow

## Landing page — `/`

Accepts a website URL and starts campaign analysis.

## Authentication — `/auth`

Provides email/password signup and login.

## Brand profile — `/campaign/:id/brand-profile`

Displays the extracted brand context and products. The user selects a product and may select an optional creator/spokesperson.

## Hook strategy — `/campaign/:id/hooks`

Displays scored, product-specific hooks and submits the selected hook for script generation.

## Script review — `/campaign/:id/scripts`

Reviews generated visual scripts, generates scene images, generates scene videos, and opens a completed script in the editor.

## Editor — `/editor`

Previews generated scene videos, configures text overlays and audio levels, and exports a WebM video with browser media APIs.
