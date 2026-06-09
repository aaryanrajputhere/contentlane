import FirecrawlApp from '@mendable/firecrawl-js';
import { brandAnalysisService } from './brand-analysis.service';

export interface WebsiteAnalysisResult {
  pages: { url: string; title: string }[];
  products: { name: string; description: string; imageUrls: string[]; url: string }[];
  productImages: string[];
  rawContent: string;
  totalProductsFound: number;
}

export class FirecrawlService {
  private app: FirecrawlApp;

  constructor() {
    this.app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  }

  async analyzeWebsite(url: string): Promise<WebsiteAnalysisResult> {
    try {
      console.log(`Mapping website: ${url}`);
      // 1. Use Firecrawl map endpoint
      const mapResult = await this.app.mapUrl(url) as any;
      
      if (mapResult.success === false) {
        throw new Error(`Failed to map URL: ${mapResult.error}`);
      }

      const rawLinks = mapResult.links || [];
      const links: string[] = rawLinks.map((l: any) => typeof l === 'string' ? l : l.url).filter(Boolean);
      console.log(`Found ${links.length} links on ${url}`);

      // 2. Categorize and prioritize links using AI
      console.log('Using AI to select the best links...');
      const linksToScrape = await brandAnalysisService.selectBestUrls(links, 8);
      console.log(`Selected ${linksToScrape.length} links to scrape via AI:`, linksToScrape);

      // 3. Scrape important pages
      const scrapeResults = await this.app.batchScrapeUrls(linksToScrape, {
        formats: ['markdown', 'html'],
      } as any) as any;

      if (scrapeResults.success === false) {
        throw new Error(`Failed to scrape URLs: ${scrapeResults.error}`);
      }

      // 4. Extract content and build result
      const totalProductsFound = links.filter(l => l.toLowerCase().includes('product')).length;
      return this.processScrapeResults(scrapeResults.data, url, totalProductsFound);
    } catch (error) {
      console.error('Error in FirecrawlService:', error);
      throw error;
    }
  }



  private processScrapeResults(data: any[], baseUrl: string, totalProductsFound: number): WebsiteAnalysisResult {
    let rawContent = "";
    const pages: { url: string; title: string }[] = [];
    const products: { name: string; description: string; imageUrls: string[]; url: string }[] = [];
    const productImages = new Set<string>();
    
    for (const page of data) {
      const url = page.metadata?.url || '';
      const title = page.metadata?.title || 'Unknown Title';
      
      if (page.markdown) {
         rawContent += `\n\n--- Page: ${url} (Title: ${title}) ---\n\n`;
         
         // Add meta description if available
         if (page.metadata?.description) {
           rawContent += `Meta Description: ${page.metadata.description}\n\n`;
         }
         
         rawContent += page.markdown;
         pages.push({ url, title });
      }

      // Helper to ensure absolute URL
      const makeAbsolute = (imgUrl: string) => {
        if (!imgUrl) return imgUrl;
        if (imgUrl.startsWith('//')) return `https:${imgUrl}`;
        if (imgUrl.startsWith('/')) {
          try {
            const urlObj = new URL(url); // the page url
            return `${urlObj.origin}${imgUrl}`;
          } catch (e) {
            return imgUrl;
          }
        }
        return imgUrl;
      };

      // Basic extraction of products based on URL (LLM will refine later)
      if (url.toLowerCase().includes('product') && page.metadata) {
         products.push({
           name: title,
           description: page.metadata.description || '',
           imageUrls: page.metadata['og:image'] ? [makeAbsolute(page.metadata['og:image'])] : [],
           url: url
         });
      }

      if (page.metadata && page.metadata['og:image']) {
         productImages.add(makeAbsolute(page.metadata['og:image']));
      }
    }

    return {
      pages,
      products,
      productImages: Array.from(productImages),
      rawContent,
      totalProductsFound,
    };
  }
}

export const firecrawlService = new FirecrawlService();
