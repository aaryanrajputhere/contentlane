import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../lib/authMiddleware";

// ── Default state for a brand-new project ──
const DEFAULT_STATE = {
  selectedCharacterIds: [],
  script: null,
  voiceoverResult: null,
  sessionId: null,
  subtitleFontSize: 90,
  subtitleX: 50,
  subtitleY: 50,
  activeColor: "#FFDE00",
  inactiveColor: "#FFFFFF",
  characterX: 5,
  characterY: 2,
  characterScale: 40,
  bgVideoUrl: "/public/assets/subway_surfer.mp4",
};

// ── List all projects for the authenticated user ──
export const listProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const style = req.query.style as string | undefined;
    const projects = await prisma.project.findMany({
      where: { userId: req.userId!, ...(style ? { style } : {}) },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        emoji: true,
        style: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json(projects);
  } catch (error: any) {
    console.error("List projects error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Create a new project ──
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, emoji, style } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    const sessionId = Date.now().toString();

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        emoji: emoji || "🎬",
        style: style || "product-hook",
        userId: req.userId!,
        state: { ...DEFAULT_STATE, sessionId },
      },
    });

    res.status(201).json({
      id: project.id,
      name: project.name,
      emoji: project.emoji,
      style: project.style,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error: any) {
    console.error("Create project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Get a single project (with full state) ──
export const getProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId! },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.status(200).json(project);
  } catch (error: any) {
    console.error("Get project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Update project state (auto-save from editor) ──
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, emoji, state } = req.body;

    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId: req.userId! },
    });

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (emoji !== undefined) updateData.emoji = emoji;
    if (state !== undefined) updateData.state = state;

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      id: updated.id,
      name: updated.name,
      emoji: updated.emoji,
      updatedAt: updated.updatedAt,
    });
  } catch (error: any) {
    console.error("Update project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Delete a project ──
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.project.findFirst({
      where: { id, userId: req.userId! },
    });

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await prisma.project.delete({ where: { id } });

    res.status(200).json({ message: "Project deleted" });
  } catch (error: any) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
