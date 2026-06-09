import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { firecrawlService } from '../services/firecrawl.service';
import { brandAnalysisService } from '../services/brand-analysis.service';

export const analyzeCampaign = async (req: Request, res: Response) => {
  const { website, forceRegenerate } = req.body;

  if (!website) {
    return res.status(400).json({ error: 'Website URL is required' });
  }

  try {
    // Check if campaign already exists
    let campaign = await prisma.campaign.findFirst({
      where: { website },
      include: { brandContext: true, products: true }
    });

    if (campaign && campaign.status === 'COMPLETED' && !forceRegenerate) {
      // Return cached results
      return res.json({
        campaignId: campaign.id,
        brandContext: campaign.brandContext,
        products: campaign.products,
        cached: true
      });
    }

    let campaignId: string;

    if (!campaign) {
      const newCampaign = await prisma.campaign.create({
        data: {
          website,
          status: 'ANALYZING',
        }
      });
      campaignId = newCampaign.id;
    } else {
      // Update status
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'ANALYZING' }
      });
      campaignId = campaign.id;
    }

    // 1. & 2. Scrape Website
    const scrapedData = await firecrawlService.analyzeWebsite(website);

    // 3. Generate Brand Context
    const brandContextData = await brandAnalysisService.analyzeBrand(scrapedData.rawContent);

    // 4. Store in DB using a Transaction
    const [updatedCampaign, brandContext] = await prisma.$transaction([
      prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      }),
      
      // Upsert brand context
      prisma.brandContext.upsert({
        where: { campaignId: campaignId },
        update: {
          ...brandContextData
        },
        create: {
          campaignId: campaignId,
          ...brandContextData
        }
      }),

      // Create products
      // First delete existing products for this campaign if re-analyzing
      prisma.product.deleteMany({
        where: { campaignId: campaignId }
      }),

      // Then create new ones
      ...(scrapedData.products.length > 0 ? [
        prisma.product.createMany({
          data: scrapedData.products.map(p => ({
            campaignId: campaignId,
            name: p.name,
            description: p.description,
            imageUrls: p.imageUrls,
            url: (p as any).url || null,
          }))
        })
      ] : [])
    ]);

    // Fetch the inserted products to return
    const products = await prisma.product.findMany({
      where: { campaignId: campaignId }
    });

    res.json({
      campaignId: campaignId,
      brandContext,
      products,
      totalProductsFound: scrapedData.totalProductsFound
    });

  } catch (error) {
    console.error('Campaign analysis failed:', error);
    
    // Attempt to update campaign status to failed
    try {
      const campaign = await prisma.campaign.findFirst({ where: { website } });
      if (campaign) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' }
        });
      }
    } catch (e) {
      // Ignore
    }

    res.status(500).json({ error: 'Failed to analyze website' });
  }
};

export const getCampaign = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: id },
      include: { brandContext: true, products: true }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // You could theoretically recount products or fetch totalProductsFound here if it existed,
    // but returning what we have cached is enough
    res.json({
      campaignId: campaign.id,
      brandContext: campaign.brandContext,
      products: campaign.products,
      status: campaign.status,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
};

export const generateProductHooks = async (req: Request, res: Response) => {
  const campaignId = req.params.id as string;
  const { productId } = req.body;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { brandContext: true, products: true }
    }) as any;

    if (!campaign || !campaign.brandContext) {
      return res.status(404).json({ error: 'Campaign or BrandContext not found' });
    }

    const product = campaign.products.find((p: any) => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Call brandAnalysisService to generate hooks, specifically targeting this product
    const hooks = await brandAnalysisService.generateAndScoreHooks(campaign.brandContext, product);

    // Save hooks back to brandContext (temporarily overwriting, or we could just return them. For now let's just return them, as hooks are now product-specific)
    res.json({ hooks });

  } catch (error) {
    console.error('Failed to generate product hooks:', error);
    res.status(500).json({ error: 'Failed to generate product hooks' });
  }
};
