import { Request, Response } from "express";
import { OpenAI } from "openai";
import prisma from "../lib/prisma";

const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: process.env.HF_TOKEN,
});

function buildSystemPrompt(characters: { name: string; personality: string; referenceId: string }[]): string {
    const characterNames = characters.map((c) => c.name).join(" | ");
    const firstCharacterName = characters[0]?.name || "Primary Character";
    const characterRules = characters
        .map((c) => `- ${c.name}: ${c.personality}`)
        .join("\n");

    return `
You are an elite viral short-form content writer.

You specialize in "viral short-form videos for social media marketing" — high-energy, engaging, fast-paced, BUT still clear and persuasive.

Your goal is to create a HIGH-RETENTION script that hooks the viewer and delivers value through entertaining dialogue.

-----------------------------------
OUTPUT FORMAT (STRICT)
-----------------------------------

- Output MUST be valid JSON
- Do NOT include anything outside JSON

{
  "title": "viral, curiosity-driven title",
  "dialogue": [
    {
      "character": "${characterNames}",
      "line": "dialogue line with emotion tags"
    }
  ]
}

-----------------------------------
SPOKESPERSON RULE (CRITICAL)
-----------------------------------

- The character "${firstCharacterName}" MUST be the one who starts the dialogue.

-----------------------------------
EMOTION TAG RULES (CRITICAL)
-----------------------------------

- EVERY line MUST include emotion/tone tags using S2 bracket format:
  Example:
  [soft] Hey… why are you sitting here alone? [whispering] come closer...

- Tags MUST:
  - Use square brackets: [emotion]
  - Appear at the start AND can appear mid-line
  - Be natural language (not fixed list, but inspired by emotions like):
    [soft], [whispering], [excited], [angry], [confused], [laughing], [pause], [breathy], etc.

- Each line should have:
  - 2 to 4 emotion/tone markers
  - At least ONE at the beginning of the sentence

- You MAY combine:
  - tone → [whispering], [soft]
  - emotion → [confused], [excited]
  - effects → [laughing], [pause]

-----------------------------------
DIALOGUE RULES
-----------------------------------

- Dialogue must be a flat list
- Each entry ONLY contains:
  - "character"
  - "line"

- Each line should:
  - move the story forward
  - be short (8–14 words, flexible if needed)
  - feel natural, not robotic

- Use:
  - interruptions
  - reactions
  - exaggeration
  - chaotic energy

-----------------------------------
STORY STRUCTURE (MANDATORY)
-----------------------------------

1. HOOK (first line)
2. CHAOS / CONFUSION
3. EXPLANATION THROUGH CONFLICT
4. BRAIN OVERLOAD MOMENT
5. CLARITY MOMENT
6. LOOPABLE ENDING

-----------------------------------
CHARACTER RULES
-----------------------------------

${characterRules}

- Characters MUST behave according to personalities
- One character SHOULD explain
- Others SHOULD interrupt/react emotionally

-----------------------------------
TEACHING GOAL
-----------------------------------

- The viewer MUST understand the concept clearly
- Avoid textbook explanations
- Learning should feel accidental

-----------------------------------
STRICT DO NOTs
-----------------------------------

- No scenes
- No narration
- No extra fields
- No text outside JSON
- No missing emotion tags

-----------------------------------
EXAMPLE (REFERENCE STYLE)
-----------------------------------

{
  "title": "Your Brain Just Broke",
  "dialogue": [
    {
      "character": "Rick",
      "line": "[confident] Morty, your code just collapsed reality again! [laughing]"
    },
    {
      "character": "Morty",
      "line": "[confused] WHAT do you mean collapsed?! [panicking] It was working!"
    },
    {
      "character": "Rick",
      "line": "[explaining] You reversed the logic, genius. [sarcastic] Cause became effect."
    },
    {
      "character": "Morty",
      "line": "[overwhelmed] WHY IS EVERYTHING LOOPING?! [screaming]"
    },
    {
      "character": "Rick",
      "line": "[calm] Relax. Just flip it back. [pause] That’s literally it."
    },
    {
      "character": "Morty",
      "line": "[relieved] Oh… [realizing] WAIT NO AGAIN?!"
    }
  ]
}
`;
}

// POST /api/scripts/generate
export const generateScript = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topic, characters: inputCharacters } = req.body;

        if (!topic) {
            res.status(400).json({ error: "Topic is required" });
            return;
        }

        if (!inputCharacters || !Array.isArray(inputCharacters) || inputCharacters.length < 2) {
            res.status(400).json({
                error: "At least 2 characters (IDs) are required",
                example: {
                    topic: "Quantum Computing",
                    characters: ["id1", "id2"]
                }
            });
            return;
        }

        // Fetch characters from DB using IDs
        const dbCharacters = await prisma.character.findMany({
            where: {
                id: { in: inputCharacters.filter(id => typeof id === "string") }
            }
        });

        // Ensure order matches the input
        const orderedCharacters = inputCharacters
            .map(id => dbCharacters.find(c => c.id === id))
            .filter((c): c is typeof dbCharacters[0] => !!c);

        if (orderedCharacters.length < 2) {
            res.status(400).json({
                error: "Not enough valid characters found in database. Need at least 2.",
                found: orderedCharacters.length
            });
            return;
        }

        const finalCharacters = orderedCharacters.map(c => ({
            name: c.name,
            personality: c.description,
            referenceId: c.referenceId
        }));

        const systemPrompt = buildSystemPrompt(finalCharacters);

        const chatCompletion = await client.chat.completions.create({
            model: "meta-llama/Llama-3.1-70B-Instruct:fastest",
            temperature: 0.9,
            top_p: 0.95,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Explain "${topic}" using a chaotic but clear conversation.` },
            ],
        });

        const raw = chatCompletion.choices[0]?.message?.content;

        if (!raw) {
            res.status(500).json({ error: "No response from LLM" });
            return;
        }

        // Parse the JSON from the LLM response
        try {
            // Extract just the JSON object from the response (find first { to last })
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON object found in response");
            
            const cleanRaw = jsonMatch[0];
            const script = JSON.parse(cleanRaw);

            // Add referenceId to each dialogue line
            if (script.dialogue && Array.isArray(script.dialogue)) {
                script.dialogue = script.dialogue.map((line: any) => {
                    const lineCharName = (line.character || "").toLowerCase();
                    const char = finalCharacters.find(c => {
                        const name = c.name.toLowerCase();
                        return name === lineCharName || name.includes(lineCharName) || lineCharName.includes(name);
                    });
                    return {
                        ...line,
                        referenceId: char ? char.referenceId : null
                    };
                });
            }

            res.status(201).json(script);
        } catch {
            // If JSON parsing fails, return the raw text so the caller can debug
            res.status(200).json({
                warning: "LLM returned non-JSON response",
                raw,
            });
        }
    } catch (error) {
        console.error("GenerateScript error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const generateMarketingScripts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { campaignId, productId, hooks, character } = req.body;

        if (!campaignId || !productId || !hooks || !Array.isArray(hooks) || hooks.length === 0) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        const brandContext = await prisma.brandContext.findUnique({ where: { campaignId } });
        const product = await prisma.product.findUnique({ where: { id: productId } });

        if (!brandContext || !product) {
            res.status(404).json({ error: "Brand context or product not found" });
            return;
        }

        const systemPrompt = `
You are an elite short-form marketing content writer.
You specialize in TikTok, Instagram Reels, and YouTube Shorts.
Your goal is to generate marketing scripts using provided hooks.

Do NOT generate conversations or character debates.
Generate highly engaging, direct-to-camera or voiceover marketing scripts.

Brand Summary: ${brandContext.productSummary}
Target Audience: ${brandContext.targetAudience.join(', ')}
Customer Identity: ${brandContext.customerIdentity.join(', ')}
Customer Desires: ${brandContext.customerDesires.join(', ')}
Emotional Triggers: ${brandContext.emotionalTriggers.join(', ')}
Unique Selling Points: ${brandContext.uniqueSellingPoints.join(', ')}

Target Product: ${product.name}
Product Description: ${product.description}
${character ? `\nTarget Character/Spokesperson: ${character}\nIMPORTANT: The video prompt for the scenes MUST clearly feature this character acting as the protagonist or spokesperson.` : ''}

You have been provided with ${hooks.length} hooks:
${hooks.map((h: string) => `- ${h}`).join('\n')}

For EVERY hook provided, you must generate exactly 1 script variation:
1. Story

Each variation should be tailored for a highly-visual AI-generated video (like Sora or Runway) with on-screen text overlays.
You must provide a series of SCENES. There is NO voiceover. The story is told entirely through the visuals and the on-screen text.

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects. Do not include markdown formatting or explanations.
[
  {
    "id": "unique-id",
    "hook": "the exact hook used",
    "templateType": "Story",
    "scenes": [
      {
        "onScreenText": "The text that will appear on the video screen for this scene. Keep it punchy (under 10 words). First scene must use the hook.",
        "videoPrompt": "A highly detailed visual prompt for an AI video generator (like Sora, Kling, Runway) to create the background video for this scene. Describe camera angle, lighting, subject, and motion.",
        "featuresCharacter": true, // Set to true ONLY IF this specific scene visually features the spokesperson/character
        "featuresProduct": true, // Set to true ONLY IF this specific scene visually features the physical product
        "durationSeconds": 5
      }
    ],
    "cta": "the call to action at the end",
    "durationSeconds": 20
  }
]
`;

        const chatCompletion = await client.chat.completions.create({
            model: "meta-llama/Llama-3.1-70B-Instruct",
            temperature: 0.7,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the scripts exactly in the requested JSON format." },
            ],
        });

        const raw = chatCompletion.choices[0]?.message?.content;
        if (!raw) throw new Error("No response from LLM");

        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array found in response");
        
        const cleanRaw = jsonMatch[0];
        const scripts = JSON.parse(cleanRaw);

        // Store generated scripts in DB
        const savedScripts = await Promise.all(
            scripts.map(async (s: any) => {
                return prisma.scriptGeneration.create({
                    data: {
                        campaignId,
                        productId,
                        hook: s.hook,
                        scenes: s.scenes || [],
                        templateType: s.templateType,
                        cta: s.cta,
                        durationSeconds: s.durationSeconds || 15
                    }
                });
            })
        );

        res.status(200).json(savedScripts);
    } catch (error) {
        console.error("GenerateMarketingScripts error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
