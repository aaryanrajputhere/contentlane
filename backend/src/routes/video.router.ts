import { Router } from "express";
import { renderVideo } from "../controllers/video.controller";

const router = Router();

router.post("/render", renderVideo);

export default router;
