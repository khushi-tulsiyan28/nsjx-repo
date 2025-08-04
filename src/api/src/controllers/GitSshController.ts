import { Request, Response } from "express";
import { GitSshService } from "../services/GitSshService";
import { WebSocketService, RepositoryEvent } from "../services/WebSocketService";
import fetch from "node-fetch";

export class GitSshController {
  private gitSshService: GitSshService;
  private webSocketService?: WebSocketService;

  constructor(webSocketService?: WebSocketService) {
    this.gitSshService = new GitSshService();
    this.webSocketService = webSocketService;
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
      const includePrivateKey = req.query.includePrivateKey === 'true';

      const sshKey = await this.gitSshService.getSshKeyById(parseInt(id), userId);
      if (!sshKey) {
        res.status(404).json({ error: "SSH key not found" });
        return;
      }

      const responseData: any = {
        id: sshKey.id,
        name: sshKey.name,
        publicKey: sshKey.publicKey,
        provider: sshKey.provider,
        description: sshKey.description,
        isActive: sshKey.isActive,
        createdAt: sshKey.createdAt,
        updatedAt: sshKey.updatedAt
      };

      // Include private key only when explicitly requested (for DAG usage)
      if (includePrivateKey && sshKey.privateKey) {
        responseData.privateKey = sshKey.privateKey;
      }

      res.status(200).json({
        message: "SSH key retrieved successfully",
        data: responseData
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
      res.status(500).json({ error: errorMessage });
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
        sshKeyId,
        sshPrivateKey,
        sshPublicKey
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

      const airflowApiUrl = process.env.AIRFLOW_API_URL || "ahttp://localhost:8080";
      const dagId = "kedro_pipeline";
      
      const dagConf: any = {
        pipeline_name: pipelineName,
        repo_url: repoUrl || "",
        branch: branch || "main",
        project_name: projectName || "kedro_project",
        experiment_name: fullExperimentName,
        guid: guid
      };

      if (sshPrivateKey && sshPublicKey) {
        dagConf.ssh_private_key = sshPrivateKey;
        dagConf.ssh_public_key = sshPublicKey;
        console.log("Using direct SSH keys for DAG configuration");
      } else if (sshKeyId) {
        dagConf.ssh_key_id = sshKeyId;
        console.log("Using SSH key ID for DAG configuration");
      }

      const dagRunPayload = {
        conf: dagConf
      };

      console.log("Triggering Airflow DAG with payload:", dagRunPayload);

      let dagRunResponse;
      const airflowUsername = process.env.AIRFLOW_USERNAME || "api_user";
      const airflowPassword = process.env.AIRFLOW_PASSWORD || "api123";
      
      console.log('Using Airflow credentials:', { 
        username: airflowUsername, 
        password: airflowPassword ? '***' : 'not set',
        env_username: process.env.AIRFLOW_USERNAME,
        env_password: process.env.AIRFLOW_PASSWORD ? '***' : 'not set'
      });
      
      try {
        // Use Airflow CLI instead of REST API to bypass authentication issues
        console.log('Using Airflow CLI to trigger DAG...');
        
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        // Create a temporary JSON file for the configuration
        const fs = require('fs');
        const tempConfigPath = `/tmp/dag_config_${guid}.json`;
        fs.writeFileSync(tempConfigPath, JSON.stringify(dagRunPayload.conf));
        
        // Execute Airflow CLI command
        const airflowCommand = `airflow dags trigger ${dagId} --conf '${JSON.stringify(dagRunPayload.conf)}'`;
        console.log(`Executing: ${airflowCommand}`);
        
        const { stdout, stderr } = await execAsync(airflowCommand, { timeout: 30000 });
        
        console.log('Airflow CLI stdout:', stdout);
        if (stderr) {
          console.log('Airflow CLI stderr:', stderr);
        }
        
        // Clean up temp file
        if (fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
        }
        
        // Check if the command was successful
        if (stdout.includes('queued') || stdout.includes('running') || stdout.includes('manual__')) {
          console.log('DAG triggered successfully via CLI');
          
          // Return success response
          res.status(200).json({
            message: "Pipeline triggered successfully",
            data: {
              guid: guid,
              dag_run_id: guid,
              state: "queued",
              experiment_name: experimentNameWithPipeline,
              pipeline_name: pipelineName,
              repo_url: repoUrl,
              created_at: new Date().toISOString(),
              method: "airflow_cli"
            }
          });
          return;
        } else {
          throw new Error(`Failed to trigger DAG via CLI: ${stderr || stdout}`);
        }
      } catch (cliError) {
        console.error('Airflow CLI error:', cliError);
        const errorMessage = cliError instanceof Error ? cliError.message : 'Unknown CLI error';
        throw new Error(`Failed to trigger DAG via Airflow CLI: ${errorMessage}`);
      }

    } catch (error) {
      console.error('Pipeline trigger error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }

  async notifyRepositorySuccess(req: Request, res: Response): Promise<void> {
    try {
      const {
        guid,
        pipeline_name,
        repo_url,
        branch,
        project_path,
        repo_status,
        validation_info,
        timestamp
      } = req.body;

      console.log("Received repository success notification:", {
        guid,
        pipeline_name,
        repo_url,
        branch,
        project_path,
        repo_status,
        validation_info,
        timestamp
      });

      const successData = {
        guid,
        pipeline_name,
        repo_url: repo_url || 'local',
        branch: branch || 'local',
        project_path,
        repo_status,
        validation_info,
        timestamp: timestamp || new Date().toISOString(),
        status: 'repository_setup_successful'
      };

      console.log("Repository setup successful:", successData);

      if (this.webSocketService) {
        const repositoryEvent: RepositoryEvent = {
          guid,
          pipeline_name,
          repo_url: repo_url || 'local',
          branch: branch || 'local',
          project_path,
          repo_status,
          validation_info,
          timestamp: timestamp || new Date().toISOString(),
          event_type: 'repository_success'
        };

        this.webSocketService.broadcastRepositoryEvent(repositoryEvent);
      }

      res.status(200).json({
        message: "Repository success notification received",
        data: {
          guid,
          status: 'acknowledged',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Repository success notification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }
} 