import { Request, Response } from 'express';
import fetch from 'node-fetch';

export class GitHubController {
  async exchangeCodeForToken(req: Request, res: Response) {
    try {
      const { code, redirect_uri } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'GitHub OAuth credentials not configured' });
      }

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirect_uri || 'http://localhost:3000/git'
        })
      });

      const data = await response.json();

      if (data.error) {
        console.error('GitHub OAuth error:', data);
        return res.status(400).json({ error: data.error_description || 'Failed to exchange code for token' });
      }

      res.json({
        access_token: data.access_token,
        token_type: data.token_type,
        scope: data.scope
      });

    } catch (error) {
      console.error('Error exchanging code for token:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }
} 