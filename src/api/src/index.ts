import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import fetch from "node-fetch";
import { initializeDatabase } from "./config/database";
import { GitSshController } from "./controllers/GitSshController";
import { GitHubController } from "./controllers/GitHubController";
import { WebSocketService } from "./services/WebSocketService";

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

const webSocketService = new WebSocketService(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/git', (req, res) => {
  const { code, error } = req.query;
  
  console.log('OAuth callback received:', { 
    code: code ? 'present' : 'missing', 
    error: error ? 'present' : 'missing',
    query: req.query,
    url: req.url 
  });
  
  if (error) {
    return res.send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body>
          <h1>OAuth Error</h1>
          <p>Error: ${error}</p>
          <script>
            window.opener.postMessage({ type: 'oauth_error', error: '${error}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
  
  if (code) {
    return res.send(`
      <html>
        <head><title>OAuth Success</title></head>
        <body>
          <h1>Authentication Successful</h1>
          <p>You can close this window and return to the application.</p>
          <script>
            window.opener.postMessage({ type: 'oauth_success', code: '${code}' }, '*');
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  }
  
  res.send(`
    <html>
      <head><title>OAuth Callback</title></head>
      <body>
        <h1>OAuth Callback</h1>
        <p>No authorization code received.</p>
      </body>
    </html>
  `);
});

initializeDatabase()
  .then(() => {
    console.log("Database initialized successfully");
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });

const gitSshController = new GitSshController(webSocketService);
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
app.post("/api/repository/success", (req, res) => gitSshController.notifyRepositorySuccess(req, res));

app.post("/api/github/exchange-code", (req, res) => gitHubController.exchangeCodeForToken(req, res));

app.post('/api/bitbucket/exchange-code', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    console.log('Exchange code request:', { code, redirect_uri });
    console.log('Environment variables:', {
      client_id: process.env.BITBUCKET_CLIENT_ID ? 'set' : 'not set',
      client_secret: process.env.BITBUCKET_CLIENT_SECRET ? 'set' : 'not set'
    });
    
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

    console.log('Token response status:', tokenResponse.status);
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json() as any;
      res.json({ access_token: tokenData.access_token });
    } else {
      const errorText = await tokenResponse.text();
      console.log('Token response error:', errorText);
      res.status(400).json({ error: 'Failed to exchange code for token', details: errorText });
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

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`WebSocket server: ws://localhost:${PORT}`);
}); 