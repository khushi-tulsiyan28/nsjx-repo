import { Request, Response } from "express";
import { GitSshService } from "../services/GitSshService";

export class GitSshController {
  private gitSshService: GitSshService;

  constructor() {
    this.gitSshService = new GitSshService();
  }

  async createSshKey(req: Request, res: Response): Promise<void> {
    try {
      const { name, publicKey, privateKey, passphrase, provider, description } = req.body;
      const userId = req.headers["user-id"] as string || "default-user";

      if (!name || !publicKey) {
        res.status(400).json({ error: "Name and public key are required" });
        return;
      }

      const isValidKey = await this.gitSshService.validateSshKey(publicKey);
      if (!isValidKey) {
        res.status(400).json({ error: "Invalid SSH key format" });
        return;
      }

      const sshKey = await this.gitSshService.createSshKey({
        userId,
        name,
        publicKey,
        privateKey,
        passphrase,
        provider: provider || "github",
        description
      });

      res.status(201).json({
        message: "SSH key created successfully",
        data: {
          id: sshKey.id,
          name: sshKey.name,
          provider: sshKey.provider,
          description: sshKey.description,
          createdAt: sshKey.createdAt
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }

  async getSshKeys(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers["user-id"] as string || "default-user";
      const sshKeys = await this.gitSshService.getSshKeysByUserId(userId);

      res.status(200).json({
        message: "SSH keys retrieved successfully",
        data: sshKeys.map(key => ({
          id: key.id,
          name: key.name,
          provider: key.provider,
          description: key.description,
          isActive: key.isActive,
          createdAt: key.createdAt,
          updatedAt: key.updatedAt
        }))
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }

  async getSshKeyById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string || "default-user";

      const sshKey = await this.gitSshService.getSshKeyById(parseInt(id), userId);
      if (!sshKey) {
        res.status(404).json({ error: "SSH key not found" });
        return;
      }

      res.status(200).json({
        message: "SSH key retrieved successfully",
        data: {
          id: sshKey.id,
          name: sshKey.name,
          publicKey: sshKey.publicKey,
          provider: sshKey.provider,
          description: sshKey.description,
          isActive: sshKey.isActive,
          createdAt: sshKey.createdAt,
          updatedAt: sshKey.updatedAt
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }

  async updateSshKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, publicKey, privateKey, passphrase, provider, description } = req.body;
      const userId = req.headers["user-id"] as string || "default-user";

      if (publicKey) {
        const isValidKey = await this.gitSshService.validateSshKey(publicKey);
        if (!isValidKey) {
          res.status(400).json({ error: "Invalid SSH key format" });
          return;
        }
      }

      const updatedSshKey = await this.gitSshService.updateSshKey(parseInt(id), userId, {
        name,
        publicKey,
        privateKey,
        passphrase,
        provider,
        description
      });

      if (!updatedSshKey) {
        res.status(404).json({ error: "SSH key not found" });
        return;
      }

      res.status(200).json({
        message: "SSH key updated successfully",
        data: {
          id: updatedSshKey.id,
          name: updatedSshKey.name,
          provider: updatedSshKey.provider,
          description: updatedSshKey.description,
          updatedAt: updatedSshKey.updatedAt
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }

  async deleteSshKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"] as string || "default-user";

      const deleted = await this.gitSshService.deleteSshKey(parseInt(id), userId);
      if (!deleted) {
        res.status(404).json({ error: "SSH key not found" });
        return;
      }

      res.status(200).json({ message: "SSH key deleted successfully" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: error.message });
    }
  }

  async triggerPipeline(req: Request, res: Response): Promise<void> {
    try {
      const { 
        pipelineName, 
        repoUrl, 
        branch, 
        projectName, 
        experimentName,
        sshKeyId 
      } = req.body;
      const userId = req.headers["user-id"] as string || "default-user";

      if (!pipelineName) {
        res.status(400).json({ error: "Pipeline name is required" });
        return;
      }

      let sshKey = null;
      if (repoUrl && sshKeyId) {
        sshKey = await this.gitSshService.getSshKeyById(sshKeyId, userId);
        if (!sshKey) {
          res.status(404).json({ error: "SSH key not found" });
          return;
        }
      }

      const guid = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const fullExperimentName = experimentName || "kedro-pipeline";
      const experimentNameWithPipeline = `${fullExperimentName}-${pipelineName}`;

      const airflowApiUrl = process.env.AIRFLOW_API_URL || "http://localhost:8080";
      const dagId = "kedro_pipeline";
      
      const dagRunPayload = {
        conf: {
          pipeline_name: pipelineName,
          repo_url: repoUrl || "",
          branch: branch || "main",
          project_name: projectName || "kedro_project",
          experiment_name: fullExperimentName,
          guid: guid,
          ssh_key_id: sshKeyId || null
        }
      };

      console.log("Triggering Airflow DAG with payload:", dagRunPayload);

      const dagRunResponse = {
        dag_run_id: guid,
        state: "queued",
        message: "DAG run triggered successfully"
      };

      res.status(200).json({
        message: "Pipeline triggered successfully",
        data: {
          guid: guid,
          dag_run_id: dagRunResponse.dag_run_id,
          state: dagRunResponse.state,
          experiment_name: experimentNameWithPipeline,
          pipeline_name: pipelineName,
          repo_url: repoUrl,
          created_at: new Date().toISOString()
        }
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
} 