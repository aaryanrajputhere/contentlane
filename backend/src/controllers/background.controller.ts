import { Request, Response } from "express";
import { readdir } from "fs/promises";
import path from "path";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

// Friendly display names for known files
const DISPLAY_NAMES: Record<string, string> = {
  "subway_surfer.mp4": "Subway Surfer",
  "minecraft.mp4": "Minecraft",
};

export const getBackgrounds = async (req: Request, res: Response): Promise<void> => {
  try {
    const assetsDir = path.join(process.cwd(), "public", "assets");
    const files = await readdir(assetsDir);

    const videos = files
      .filter((f) => VIDEO_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)))
      .map((f) => ({
        filename: f,
        url: `/public/assets/${f}`,
        name: DISPLAY_NAMES[f] ?? f.replace(/\.[^.]+$/, "").replace(/_/g, " "),
      }));

    res.status(200).json(videos);
  } catch (error: any) {
    console.error("Failed to list backgrounds:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};
