import { Request, Response } from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Cache the bundle so we don't re-bundle on every render
let cachedBundleLocation: string | null = null;

async function getBundle(): Promise<string> {
    if (cachedBundleLocation) {
        console.log("📦 Using cached Remotion bundle.");
        return cachedBundleLocation;
    }

    const t = Date.now();
    console.log("📦 Bundling Remotion project (first time only)...");
    const entryPoint = path.join(process.cwd(), "..", "video-renderer", "src", "index.ts");

    cachedBundleLocation = await bundle({
        entryPoint,
        publicDir: path.join(process.cwd(), "public"),
    });
    console.log(`✅ Bundle created and cached in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    return cachedBundleLocation;
}

export const renderVideo = async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.body;

    if (!sessionId) {
        res.status(400).json({ error: "sessionId is required" });
        return;
    }

    const sessionDir = path.join(process.cwd(), "public", "voiceovers", sessionId);
    const metadataPath = path.join(sessionDir, "script.json");
    const outputDir = path.join(process.cwd(), "public", "renders");
    const outputPath = path.join(outputDir, `${sessionId}.mp4`);

    try {
        const totalStart = Date.now();

        // 1. Check if metadata exists
        const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
        await fs.mkdir(outputDir, { recursive: true });

        // 2. Get the bundle (cached after first call)
        let t = Date.now();
        const bundleLocation = await getBundle();
        console.log(`[${sessionId}] ⏱ Bundle step: ${((Date.now() - t) / 1000).toFixed(1)}s`);

        // 3. Select the composition
        t = Date.now();
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: "ReelSwarmVideo",
            inputProps: metadata,
        });
        console.log(`[${sessionId}] ⏱ Composition select: ${((Date.now() - t) / 1000).toFixed(1)}s`);
        console.log(`[${sessionId}] 📐 ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`);

        // 4. Render the media
        const cpuCount = os.cpus().length;
        const concurrency = Math.max(1, cpuCount - 1);

        t = Date.now();
        console.log(`[${sessionId}] 🎬 Rendering (concurrency: ${concurrency}, cores: ${cpuCount})...`);

        let lastLoggedProgress = 0;
        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: "h264",
            outputLocation: outputPath,
            inputProps: metadata,
            concurrency,
            jpegQuality: 80,
            onProgress: ({ progress }) => {
                const pct = Math.floor(progress * 100);
                if (pct >= lastLoggedProgress + 10) {
                    lastLoggedProgress = pct;
                    console.log(`[${sessionId}] 🔄 Render progress: ${pct}%`);
                }
            },
        });

        const renderTime = ((Date.now() - t) / 1000).toFixed(1);
        const totalTime = ((Date.now() - totalStart) / 1000).toFixed(1);
        console.log(`✓ Render completed in ${renderTime}s (total: ${totalTime}s) → ${outputPath}`);

        res.status(200).json({
            message: "Video rendered successfully",
            videoUrl: `/public/renders/${sessionId}.mp4`,
            sessionId,
            renderTimeSeconds: parseFloat(renderTime),
            totalTimeSeconds: parseFloat(totalTime),
        });

    } catch (error) {
        console.error("Video rendering error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
