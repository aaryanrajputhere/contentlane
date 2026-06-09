import { Router } from "express";
import { getBackgrounds } from "../controllers/background.controller";

const router = Router();

router.get("/", getBackgrounds);

export default router;
