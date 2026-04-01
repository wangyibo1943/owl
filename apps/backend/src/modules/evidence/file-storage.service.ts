import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, join } from 'node:path';

type StorageBackend = 'local' | 'supabase';

@Injectable()
export class FileStorageService {
  private readonly localRoot =
    process.env.FILE_STORAGE_LOCAL_ROOT?.trim() ||
    join(process.cwd(), 'generated', 'evidence-files');

  private readonly backend: StorageBackend =
    (process.env.FILE_STORAGE_BACKEND?.trim().toLowerCase() as
      | StorageBackend
      | undefined) ||
    (process.env.SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? 'supabase'
      : 'local');

  private readonly bucketName =
    process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'tradeguard-evidence';

  private readonly client: SupabaseClient | null;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    this.client =
      url && serviceRoleKey
        ? createClient(url, serviceRoleKey, {
            auth: { persistSession: false },
          })
        : null;
  }

  async saveFile(
    storagePath: string,
    content: Buffer,
    options?: { contentType?: string | null },
  ) {
    if (this.backend === 'supabase' && this.client) {
      await this.ensureBucket();

      const { error } = await this.client.storage
        .from(this.bucketName)
        .upload(storagePath, content, {
          contentType: options?.contentType ?? undefined,
          upsert: true,
        });

      if (error) {
        throw new InternalServerErrorException({
          success: false,
          error_code: 'FILE_STORAGE_ERROR',
          message: `Object storage upload failed: ${error.message}`,
        });
      }

      return {
        storage_path: storagePath,
        bucket: this.bucketName,
        backend: this.backend,
      };
    }

    const absolutePath = this.resolvePath(storagePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);

    return {
      storage_path: storagePath,
      absolute_path: absolutePath,
      backend: this.backend,
    };
  }

  async readFile(storagePath: string) {
    if (this.backend === 'supabase' && this.client) {
      await this.ensureBucket();

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .download(storagePath);

      if (!error && data) {
        return {
          storage_path: storagePath,
          bucket: this.bucketName,
          backend: this.backend,
          content: Buffer.from(await data.arrayBuffer()),
        };
      }
    }

    const absolutePath = this.resolvePath(storagePath);

    try {
      await access(absolutePath, fsConstants.R_OK);
    } catch {
      throw new NotFoundException({
        success: false,
        error_code: 'FILE_NOT_FOUND',
        message: 'Stored file was not found',
      });
    }

    return {
      storage_path: storagePath,
      absolute_path: absolutePath,
      backend: this.backend,
      content: await readFile(absolutePath),
    };
  }

  async ensureWritable() {
    if (this.backend === 'supabase' && this.client) {
      await this.ensureBucket();
      return;
    }

    try {
      await mkdir(this.localRoot, { recursive: true });
    } catch {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'FILE_STORAGE_ERROR',
        message: 'File storage root could not be prepared',
      });
    }
  }

  private async ensureBucket() {
    if (!this.client) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'FILE_STORAGE_ERROR',
        message: 'Object storage client is not configured',
      });
    }

    if (!this.bucketReadyPromise) {
      this.bucketReadyPromise = (async () => {
        const { data, error } = await this.client!.storage.listBuckets();

        if (error) {
          throw new InternalServerErrorException({
            success: false,
            error_code: 'FILE_STORAGE_ERROR',
            message: `Object storage bucket lookup failed: ${error.message}`,
          });
        }

        const exists = (data ?? []).some(
          (bucket) => bucket.name === this.bucketName || bucket.id === this.bucketName,
        );

        if (exists) {
          return;
        }

        const { error: createError } = await this.client!.storage.createBucket(
          this.bucketName,
          {
            public: false,
          },
        );

        if (createError) {
          throw new InternalServerErrorException({
            success: false,
            error_code: 'FILE_STORAGE_ERROR',
            message: `Object storage bucket creation failed: ${createError.message}`,
          });
        }
      })();
    }

    return this.bucketReadyPromise;
  }

  private resolvePath(storagePath: string) {
    const normalized = storagePath.replace(/^\/+/, '');
    return join(this.localRoot, normalized);
  }
}
