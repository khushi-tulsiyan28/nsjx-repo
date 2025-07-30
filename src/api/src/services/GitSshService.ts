import { Repository } from "typeorm";
import { AppDataSource } from "../config/database";
import { GitSshKey } from "../entities/GitSshKey";

export class GitSshService {
  private gitSshRepository: Repository<GitSshKey>;

  constructor() {
    this.gitSshRepository = AppDataSource.getRepository(GitSshKey);
  }

  async createSshKey(sshKeyData: Partial<GitSshKey>): Promise<GitSshKey> {
    try {
      const sshKey = this.gitSshRepository.create(sshKeyData);
      return await this.gitSshRepository.save(sshKey);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Failed to create SSH key: ${errorMessage}`);
    }
  }

  async getSshKeysByUserId(userId: string): Promise<GitSshKey[]> {
    try {
      return await this.gitSshRepository.find({
        where: { userId, isActive: true },
        order: { createdAt: "DESC" }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Failed to fetch SSH keys: ${errorMessage}`);
    }
  }

  async getSshKeyById(id: number, userId: string): Promise<GitSshKey | null> {
    try {
      return await this.gitSshRepository.findOne({
        where: { id, userId, isActive: true }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Failed to fetch SSH key: ${errorMessage}`);
    }
  }

  async updateSshKey(id: number, userId: string, updateData: Partial<GitSshKey>): Promise<GitSshKey | null> {
    try {
      const sshKey = await this.getSshKeyById(id, userId);
      if (!sshKey) {
        return null;
      }

      Object.assign(sshKey, updateData);
      return await this.gitSshRepository.save(sshKey);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Failed to update SSH key: ${errorMessage}`);
    }
  }

  async deleteSshKey(id: number, userId: string): Promise<boolean> {
    try {
      const sshKey = await this.getSshKeyById(id, userId);
      if (!sshKey) {
        return false;
      }

      sshKey.isActive = false;
      await this.gitSshRepository.save(sshKey);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Failed to delete SSH key: ${errorMessage}`);
    }
  }

  async validateSshKey(publicKey: string): Promise<boolean> {
    const sshKeyPattern = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+[=]{0,3}\s+[^@]+@[^@]+$/;
    return sshKeyPattern.test(publicKey.trim());
  }
} 