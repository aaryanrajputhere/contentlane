import { Router } from "express";
import { generateScript, generateMarketingScripts } from "../controllers/scripts.controller";

const router = Router();

// POST /api/scripts/generate (Legacy)
router.post("/generate", generateScript);

// POST /api/scripts/generate-marketing
router.post("/generate-marketing", generateMarketingScripts);

export default router;
