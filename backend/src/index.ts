import "dotenv/config";
import express from "express";
import scriptsRouter from "./routes/scripts.router";
import voiceRouter from "./routes/voiceover.router";
import characterRouter from "./routes/character.router";
import videoRouter from "./routes/video.router";
import authRouter from "./routes/auth.router";
import backgroundRouter from "./routes/background.router";
import projectRouter from "./routes/project.router";
import campaignsRouter from "./routes/campaigns.route";
import proxyRouter from "./routes/proxy.router";
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/api/scripts", scriptsRouter);
app.use("/api/voice", voiceRouter); 
app.use("/api/characters", characterRouter);
app.use("/api/video", videoRouter);
app.use("/api/auth", authRouter);
app.use("/api/backgrounds", backgroundRouter);
app.use("/api/projects", projectRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/proxy", proxyRouter);

// Allow assets to be loaded in cross-origin isolated contexts
app.use("/public", (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
}, express.static("public"));

app.listen(3000, () => {
    console.log("Server started on port 3000");
});
