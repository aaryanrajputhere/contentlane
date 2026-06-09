import { HfInference } from '@huggingface/inference';

export interface BrandContextData {
  brandName: string;
  productCategory: string;
  productSummary: string;
  targetAudience: string[];
  benefits: string[];
  painPoints: string[];
  objections: string[];
  uniqueSellingPoints: string[];
  brandVoice: string;
  socialProof: string[];
  customerDesires: string[];
  emotionalTriggers: string[];
  purchaseMotivations: string[];
  contentAngles: string[];
  competitorAlternatives: string[];
  customerIdentity: string[];
  hooks?: any;
}

export class BrandAnalysisService {
  private hf: HfInference;

  constructor() {
    this.hf = new HfInference(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);
  }

  async analyzeBrand(websiteContent: string): Promise<BrandContextData> {
    const prompt = `
You are an elite TikTok/Reels content strategist and creative director. 
Your goal is to analyze the following business website content and extract hyper-specific brand information optimized for viral short-form content creation, hook generation, and storytelling.

Do NOT act like a generic business analyst. Think about what emotions drive a purchase and what content performs well.

1. "productCategory" MUST be hyper-specific and immediately explain what is being sold (e.g., "Handcrafted Fantasy-Themed Ambient Lamps" instead of "Home Decor").
2. "productSummary" MUST be a 1-2 sentence compelling summary of the product and who it's for.
3. "customerDesires" MUST focus on what the customer genuinely WANTS (e.g., "Express fandom identity").
4. "emotionalTriggers" MUST be core emotions used for hooks (e.g., "Nostalgia", "Fandom pride").
5. "customerIdentity" MUST describe how the customer identifies themselves (e.g., "Fantasy enthusiasts", "HTTYD fans").
6. "competitorAlternatives" MUST list what they'd buy otherwise, for comparison content.

Return ONLY a strictly valid JSON object with these exact keys:
- brandName (string)
- productCategory (string)
- productSummary (string)
- targetAudience (array of strings)
- benefits (array of strings)
- painPoints (array of strings)
- objections (array of strings)
- uniqueSellingPoints (array of strings)
- brandVoice (string)
- socialProof (array of strings)
- customerDesires (array of strings)
- emotionalTriggers (array of strings)
- purchaseMotivations (array of strings)
- competitorAlternatives (array of strings)
- customerIdentity (array of strings)
- customerIdentity (array of strings)

Website Content:
${websiteContent.substring(0, 15000)}
`;

    try {
      console.log('Sending request to Hugging Face LLaMA...');
      const response = await this.hf.chatCompletion({
        model: "meta-llama/Llama-3.1-70B-Instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
        temperature: 0.2,
      });

      const responseText = response.choices[0]?.message?.content || "{}";
      
      // Clean up markdown if any
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanedText);
      return this.validateResponse(parsed);
    } catch (error) {
      console.error("Failed to analyze brand:", error);
      throw new Error("Brand analysis failed");
    }
  }

  async selectBestUrls(urls: string[], max: number = 8): Promise<string[]> {
    if (urls.length <= max) return urls;

    // Filter out obviously irrelevant URLs to save tokens
    const filteredUrls = urls.filter(url => {
      const lower = url.toLowerCase();
      return !lower.includes('.jpg') && !lower.includes('.png') && !lower.includes('.xml') && 
             !lower.includes('policy') && !lower.includes('terms') && !lower.includes('login') &&
             !lower.includes('cart') && !lower.includes('checkout');
    });

    const urlsString = filteredUrls.slice(0, 150).join('\n'); // limit to ~150 urls

    const prompt = `
Given the following list of URLs from a brand's website, select up to ${max} URLs that are most likely to contain valuable information about the brand's identity, target audience, and primary products.
Prioritize the homepage, "About Us", "FAQ", and top-level product/collection pages. Try to pick product pages which have actual products.

URLs:
${urlsString}

Return strictly a JSON array of strings containing the exact URLs you selected. Do not include markdown formatting or explanations.
`;

    try {
      console.log('Sending URL selection request to Hugging Face LLaMA...');
      const response = await this.hf.chatCompletion({
        model: "meta-llama/Llama-3.1-70B-Instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const responseText = response.choices[0]?.message?.content || "[]";
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, max);
      }
    } catch (error) {
      console.error("Failed to select best URLs via AI, falling back to basic selection:", error);
    }

    // Fallback if AI fails
    return filteredUrls.slice(0, max);
  }

  private validateResponse(data: any): BrandContextData {
    return {
      brandName: data.brandName || "Unknown Brand",
      productCategory: data.productCategory || "Unknown Category",
      productSummary: data.productSummary || "",
      targetAudience: Array.isArray(data.targetAudience) ? data.targetAudience : [],
      benefits: Array.isArray(data.benefits) ? data.benefits : [],
      painPoints: Array.isArray(data.painPoints) ? data.painPoints : [],
      objections: Array.isArray(data.objections) ? data.objections : [],
      uniqueSellingPoints: Array.isArray(data.uniqueSellingPoints) ? data.uniqueSellingPoints : [],
      brandVoice: data.brandVoice || "Professional",
      socialProof: Array.isArray(data.socialProof) ? data.socialProof : [],
      customerDesires: Array.isArray(data.customerDesires) ? data.customerDesires : [],
      emotionalTriggers: Array.isArray(data.emotionalTriggers) ? data.emotionalTriggers : [],
      purchaseMotivations: Array.isArray(data.purchaseMotivations) ? data.purchaseMotivations : [],
      contentAngles: Array.isArray(data.contentAngles) ? data.contentAngles : [],
      competitorAlternatives: Array.isArray(data.competitorAlternatives) ? data.competitorAlternatives : [],
      customerIdentity: Array.isArray(data.customerIdentity) ? data.customerIdentity : [],
      hooks: data.hooks || null,
    };
  }

  async generateAndScoreHooks(brandContext: BrandContextData, product?: any): Promise<any> {
    const prompt1 = `
You are:
* A top TikTok creator
* A top UGC creator
* A direct-response marketer
* A creative strategist

You are NOT:
* A business analyst
* A content manager
* A social media intern

IMPORTANT CHANGE:
Do NOT generate "content ideas".
Do NOT generate "topics".
Do NOT generate "post titles".
Generate: SCROLL-STOPPING VIDEO HOOKS
Specifically: The FIRST sentence a creator would say in a short-form video.

The goal is:
Make the user stop scrolling.
Make them curious enough to watch.
Make them emotionally invested.

BAD EXAMPLES (Do NOT generate outputs like):
* Product Review
* Unboxing
* Space Jam Fans Unite
* Customer Showcase
* Behind The Scenes
* My Favorite Lamp
* Remember Looney Tunes?
* What's inside?
* 90s kids only
These are weak. These are generic. These do not create curiosity.

GOOD EXAMPLES (Generate hooks like):
🔥 Every 90s kid wanted this in their room
🔥 This unlocked a childhood memory instantly
🔥 Only collectors understand why this matters
🔥 I didn't expect this lamp to look this good
🔥 Guess how many hours this took to make
🔥 There's a reason no two are identical
🔥 POV: You finally have adult money
🔥 This isn't a lamp. It's nostalgia.
🔥 Mass-produced decor could never do this
🔥 I almost didn't buy this and now I'm obsessed

Notice:
* Emotional
* Specific
* Curiosity-driven
* Scroll-stopping
* Conversational

Every hook should be:
* Under 15 words
* Easy to understand
* Native to TikTok, Reels, Shorts

Do not generate explanations. Generate hooks only.

Generate hooks grouped into categories.
Generate 5 hooks per category. Total 30 hooks.
Return ONLY a valid JSON object:
{
  "nostalgia": ["...", ...],
  "pov": ["...", ...],
  "story": ["...", ...],
  "curiosity": ["...", ...],
  "comparison": ["...", ...],
  "identity": ["...", ...]
}

Category Definitions:
Nostalgia (Trigger memories): e.g., "Only 90s kids will understand this", "This unlocked a childhood memory instantly"
POV: e.g., "POV: You finally have adult money", "POV: Your room finally reflects your personality"
Story: e.g., "I didn't expect this to become my favorite thing", "The collectible I almost didn't buy"
Curiosity: e.g., "Guess how many hours this took to make", "There's a reason no two are identical"
Comparison: e.g., "Handmade vs mass-produced decor", "Why collectors avoid cheap replicas"
Identity: e.g., "Only true Space Jam fans understand this", "Collectors know exactly why this matters"

Brand Context (Use heavily to tailor hooks to the business):
- Target Audience: ${brandContext.targetAudience?.join(', ')}
- Customer Identity: ${brandContext.customerIdentity?.join(', ')}
- Emotional Triggers: ${brandContext.emotionalTriggers?.join(', ')}
- Customer Desires: ${brandContext.customerDesires?.join(', ')}
- Unique Selling Points: ${brandContext.uniqueSellingPoints?.join(', ')}
${product ? `
Target Product:
- Product Name: ${product.name}
- Product Description: ${product.description}
MAKE SURE HOOKS ARE SPECIFIC TO THIS PRODUCT.
` : `
- Product Summary: ${brandContext.productSummary}
`}
`;

    try {
      console.log('Generating hooks...');
      const response1 = await this.hf.chatCompletion({
        model: "meta-llama/Llama-3.1-70B-Instruct",
        messages: [{ role: "user", content: prompt1 }],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const responseText1 = response1.choices[0]?.message?.content || "{}";
      const cleanedText1 = responseText1.replace(/\`\`\`json\n?/g, '').replace(/\`\`\`\n?/g, '').trim();
      const generatedHooks = JSON.parse(cleanedText1);

      const prompt2 = `
You are a TikTok viral content evaluator.
Given the following categorized hooks, score each one from 1 to 10 based on:
- Curiosity
- Emotional impact
- Scroll-stopping potential
- Audience relevance
- TikTok/Reels performance likelihood

Return ONLY a valid JSON object mapping each category to an array of objects containing the "text" and "score".
Keep only hooks scoring 8 or higher. Do NOT include hooks scoring below 8.
Format:
{
  "nostalgia": [
    { "text": "hook1", "score": 9 },
    ...
  ],
  ...
}

Hooks to evaluate:
${JSON.stringify(generatedHooks)}
`;

      console.log('Scoring hooks...');
      const response2 = await this.hf.chatCompletion({
        model: "meta-llama/Llama-3.1-70B-Instruct",
        messages: [{ role: "user", content: prompt2 }],
        max_tokens: 2500,
        temperature: 0.2,
      });

      const responseText2 = response2.choices[0]?.message?.content || "{}";
      const cleanedText2 = responseText2.replace(/\`\`\`json\n?/g, '').replace(/\`\`\`\n?/g, '').trim();
      const scoredHooks = JSON.parse(cleanedText2);

      return scoredHooks;
    } catch (error) {
      console.error("Failed to generate and score hooks:", error);
      return {};
    }
  }
}

export const brandAnalysisService = new BrandAnalysisService();
