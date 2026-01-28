import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ComponentDoc } from '../config/schema.js';

interface CacheEntry {
  hash: string;
  doc: ComponentDoc;
  timestamp: number;
  modelVersion: string;
}

interface CacheManifest {
  version: string;
  entries: Record<string, CacheEntry>;
}

export class DocumentationCache {
  private cacheDir: string;
  private manifestPath: string;
  private manifest: CacheManifest | null = null;
  private readonly CACHE_VERSION = '2.0';
  private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.manifestPath = path.join(cacheDir, 'manifest.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });

    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content);

      // Invalidate if cache version changed
      if (this.manifest?.version !== this.CACHE_VERSION) {
        this.manifest = null;
      }
    } catch {
      this.manifest = null;
    }

    if (!this.manifest) {
      this.manifest = { version: this.CACHE_VERSION, entries: {} };
    }

    // Prune old entries
    await this.prune();
  }

  private computeHash(content: string, modelVersion: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .update(modelVersion)
      .digest('hex')
      .slice(0, 16);
  }

  async get(filePath: string, content: string, modelVersion: string): Promise<ComponentDoc | null> {
    if (!this.manifest) await this.init();

    const hash = this.computeHash(content, modelVersion);
    const entry = this.manifest!.entries[filePath];

    if (entry && entry.hash === hash && entry.modelVersion === modelVersion) {
      // Check if not too old
      if (Date.now() - entry.timestamp < this.MAX_AGE_MS) {
        return entry.doc;
      }
    }

    return null;
  }

  async set(filePath: string, content: string, modelVersion: string, doc: ComponentDoc): Promise<void> {
    if (!this.manifest) await this.init();

    const hash = this.computeHash(content, modelVersion);

    this.manifest!.entries[filePath] = {
      hash,
      doc,
      timestamp: Date.now(),
      modelVersion,
    };

    await this.persist();
  }

  async invalidate(filePath: string): Promise<void> {
    if (!this.manifest) await this.init();
    delete this.manifest!.entries[filePath];
    await this.persist();
  }

  async invalidateAll(): Promise<void> {
    this.manifest = { version: this.CACHE_VERSION, entries: {} };
    await this.persist();
  }

  private async prune(): Promise<void> {
    if (!this.manifest) return;

    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of Object.entries(this.manifest.entries)) {
      if (now - entry.timestamp > this.MAX_AGE_MS) {
        delete this.manifest.entries[key];
        pruned++;
      }
    }

    if (pruned > 0) {
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  getStats(): { total: number; sizeKB: number } {
    const entries = Object.keys(this.manifest?.entries ?? {}).length;
    const size = JSON.stringify(this.manifest).length / 1024;
    return { total: entries, sizeKB: Math.round(size * 100) / 100 };
  }
}
