import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initializeDatabase } from "./config/database";
import { GitSshController } from "./controllers/GitSshController";
import { GitHubController } from "./controllers/GitHubController";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initializeDatabase()
  .then(() => {
    console.log("Database initialized successfully");
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });

const gitSshController = new GitSshController();
const gitHubController = new GitHubController();

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "API is running" });
});

app.post("/api/ssh-keys", (req, res) => gitSshController.createSshKey(req, res));
app.get("/api/ssh-keys", (req, res) => gitSshController.getSshKeys(req, res));
app.get("/api/ssh-keys/:id", (req, res) => gitSshController.getSshKeyById(req, res));
app.put("/api/ssh-keys/:id", (req, res) => gitSshController.updateSshKey(req, res));
app.delete("/api/ssh-keys/:id", (req, res) => gitSshController.deleteSshKey(req, res));

app.post("/api/pipelines/trigger", (req, res) => gitSshController.triggerPipeline(req, res));

app.post("/api/github/exchange-code", (req, res) => gitHubController.exchangeCodeForToken(req, res));

app.post('/api/bitbucket/exchange-code', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    const tokenResponse = await fetch('https://bitbucket.org/site/oauth2/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        client_id: process.env.BITBUCKET_CLIENT_ID || '',
        client_secret: process.env.BITBUCKET_CLIENT_SECRET || ''
      })
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json() as any;
      res.json({ access_token: tokenData.access_token });
    } else {
      res.status(400).json({ error: 'Failed to exchange code for token' });
    }
  } catch (error) {
    console.error('Bitbucket OAuth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
}); 