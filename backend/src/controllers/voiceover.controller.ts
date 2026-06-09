import { Request, Response } from "express";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAudioDurationInSeconds } from "get-audio-duration";
import prisma from "../lib/prisma";

let fishAudio: any = null;

async function getFishAudio() {
    if (!fishAudio) {
        // Use eval to bypass ts-node transpiling import() to require() in CommonJS
        const { FishAudioClient } = await (eval('import("fish-audio")') as Promise<any>);
        fishAudio = new FishAudioClient({ apiKey: process.env.FISH_API_KEY || "" });
    }
    return fishAudio;
}

// Cache for voice models to avoid redundant API calls
let modelCache: any[] = [];



async function fetchModelId(characterName: string): Promise<string | null> {
    try {
        if (modelCache.length === 0) {
            console.log("Fetching voice models from Fish Audio...");
            const response = await fetch("https://api.fish.audio/v1/model?page_size=100", {
                headers: { "Authorization": `Bearer ${process.env.FISH_API_KEY}` }
            });

            if (!response.ok) {
                const text = await response.text();
                console.warn(`Fish Audio Model API returned ${response.status}: ${text}`);
                return null;
            }

            const data = await response.json() as any;
            if (data.items) {
                modelCache = data.items;
                console.log(`Successfully cached ${modelCache.length} voice models.`);
            }
        }

        const nameMatch = characterName.toLowerCase();
        const model = modelCache.find(m => 
            m.title.toLowerCase().includes(nameMatch) || 
            (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(nameMatch)))
        );

        if (!model) {
            console.warn(`No voice model found matching: ${characterName}`);
        }

        return model ? model._id : null;
    } catch (error) {
        console.error("Error fetching models:", error);
        return null;
    }
}

export const generateScriptVoiceover = async (req: Request, res: Response): Promise<void> => {
    try {
        const { dialogue, sessionId: reqSessionId } = req.body;
        const sessionId = reqSessionId || Date.now().toString();
        const publicDir = path.join(process.cwd(), "public", "voiceovers");
        const sessionDir = path.join(publicDir, sessionId);

        if (!dialogue || !Array.isArray(dialogue)) {
            res.status(400).json({ error: "Invalid dialogue format" });
            return;
        }

        await mkdir(sessionDir, { recursive: true });

        let currentTime = 0;
        const processedScenes = [];

        // 1. Process each dialogue line one by one to get precise timing
        for (let i = 0; i < dialogue.length; i++) {
            const item = dialogue[i];
            const identifier = item.characterId || item.character;
            
            // Resolve the character from DB to get the correct referenceId and metadata
            const charData = await prisma.character.findFirst({
                where: identifier ? {
                    OR: [
                        { id: identifier },
                        { name: { equals: identifier, mode: 'insensitive' } }
                    ]
                } : undefined
            });

            // Priority: referenceId from DB > referenceId from request > fallback from ENV
            let refId = charData?.referenceId || item.referenceId;

            if (!refId || refId === "your_id_here") {
                refId = process.env.REFERENCE_ID;
            }

            if (!refId || refId === "your_id_here") {
                throw new Error(`No voice reference ID found for character "${charData?.name || identifier}". Please update the character in the database or set a default REFERENCE_ID in .env`);
            }

            const lineIdx = item.originalIndex !== undefined ? item.originalIndex : i;
            console.log(`Generating audio for line ${lineIdx} (${charData?.name || identifier}) using ID ${refId}...`);

            const response = await fetch("https://api.fish.audio/v1/tts", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: item.line,
                    reference_id: [refId], 
                    format: "mp3",
                    normalize: true,
                    latency: "normal"
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate audio for line ${lineIdx}: ${errorText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const outputFilename = `line_${lineIdx}.mp3`;
            const outputPath = path.join(sessionDir, outputFilename);

            await writeFile(outputPath, buffer);

            // 2. Measure the exact duration of the generated audio
            const duration = await getAudioDurationInSeconds(outputPath);

            // 3. Add to our metadata array (Clean text for subtitles)
            const cleanText = item.line.replace(/\[.*?\]/g, '').trim();
            processedScenes.push({
                characterId: charData?.id || identifier,
                characterName: charData?.name || identifier,
                text: cleanText,
                audioUrl: `/public/voiceovers/${sessionId}/${outputFilename}`,
                start: currentTime,
                duration: duration,
                imageUrl: `/public/characters/${(charData?.name || identifier || "unknown").toLowerCase()}.png` 
            });

            // 4. Update the timeline offset
            currentTime += duration;
        }

        // 5. Create the Final Script JSON for Remotion
        const finalMetadata = {
            sessionId,
            totalDuration: currentTime,
            scenes: processedScenes,
            bgVideoUrl: "/public/assets/subway_surfer.mp4" 
        };

        const metadataPath = path.join(sessionDir, "script.json");
        await writeFile(metadataPath, JSON.stringify(finalMetadata, null, 2));

        res.status(200).json({
            message: "Script voiceover and timing metadata generated",
            sessionId: sessionId,
            metadataUrl: `/public/voiceovers/${sessionId}/script.json`,
            data: finalMetadata
        });

    } catch (error: any) {
        console.error("Script voiceover error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

export const generateVoiceOver = async (req: Request, res: Response): Promise<void> => {
    try {
        const { text, reference_id, sessionId, lineIndex } = req.body;

        if (!text) {
            res.status(400).json({ error: "Text is required" });
            return;
        }

        let refId = reference_id || process.env.REFERENCE_ID;
        const sId = sessionId || Date.now().toString();
        const lIdx = lineIndex !== undefined ? lineIndex : "custom";

        if (!refId || refId === "your_id_here") {
            res.status(400).json({ error: "No valid voice reference ID found. Please set a valid REFERENCE_ID in .env or update the character." });
            return;
        }

        console.log(`Generating audio for single line ${lIdx} using ID ${refId}...`);

        const response = await fetch("https://api.fish.audio/v1/tts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: text,
                reference_id: [refId], 
                format: "mp3",
                normalize: true,
                latency: "normal"
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Fish Audio API error for line ${lIdx}:`, errorText);
            res.status(response.status).json({ error: `Fish Audio API error: ${errorText}` });
            return;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        
        const publicDir = path.join(process.cwd(), "public", "voiceovers");
        const sessionDir = path.join(publicDir, sId);
        await mkdir(sessionDir, { recursive: true });

        const filename = `line_${lIdx}.mp3`;
        const filepath = path.join(sessionDir, filename);
        
        await writeFile(filepath, buffer);
        const duration = await getAudioDurationInSeconds(filepath);
        console.log(`✓ Audio saved to ${sId}/${filename} (${duration}s)`);

        res.status(200).json({ 
            message: "Audio saved successfully", 
            url: `/public/voiceovers/${sId}/${filename}`,
            filename: filename,
            duration: duration
        });
    } catch (error: any) {
        console.error("Voiceover error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};