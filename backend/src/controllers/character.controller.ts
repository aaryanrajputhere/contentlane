import { Request, Response } from "express";
import prisma from "../lib/prisma";

// GET /api/characters
export const getAllCharacters = async (req: Request, res: Response): Promise<void> => {
    try {
        const characters = await prisma.character.findMany();
        const charactersWithImages = characters.map(c => ({
            ...c,
            imageUrl: `/public/characters/${c.name.toLowerCase()}.png`
        }));
        res.status(200).json(charactersWithImages);
    } catch (error) {
        console.error("Error fetching characters:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// GET /api/characters/:id
export const getCharacterById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const character = await prisma.character.findUnique({
            where: { id: id as string }
        });

        if (!character) {
            res.status(404).json({ error: "Character not found" });
            return;
        }

        res.status(200).json({
            ...character,
            imageUrl: `/public/characters/${character.name.toLowerCase()}.png`
        });
    } catch (error) {
        console.error("Error fetching character:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// POST /api/characters
export const createCharacter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, referenceId, description, tags, category } = req.body;

        if (!name || !referenceId || !category) {
            res.status(400).json({ error: "Name, referenceId, and category are required" });
            return;
        }

        const character = await prisma.character.create({
            data: {
                name,
                referenceId,
                description: description || "",
                tags: tags || [],
                category
            }
        });

        res.status(201).json(character);
    } catch (error) {
        console.error("Error creating character:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// PUT /api/characters/:id
export const updateCharacter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, referenceId, description, tags, category } = req.body;

        const character = await prisma.character.update({
            where: { id: id as string },
            data: {
                name,
                referenceId,
                description,
                tags,
                category
            }
        });

        res.status(200).json(character);
    } catch (error) {
        console.error("Error updating character:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /api/characters/:id
export const deleteCharacter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        await prisma.character.delete({
            where: { id: id as string }
        });

        res.status(204).send();
    } catch (error) {
        console.error("Error deleting character:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
