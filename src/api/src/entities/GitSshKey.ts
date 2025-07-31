import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("git_ssh_keys")
export class GitSshKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  userId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text" })
  publicKey!: string;

  @Column({ type: "text", nullable: true })
  privateKey!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  passphrase!: string;

  @Column({ type: "varchar", length: 255, default: "bitbucket" })
  provider!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "text", nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
} 