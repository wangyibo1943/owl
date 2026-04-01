import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, dirname } from 'node:path';

@Injectable()
export class FileStorageService {
  private readonly localRoot =
    process.env.FILE_STORAGE_LOCAL_ROOT?.trim() ||
    join(process.cwd(), 'generated', 'evidence-files');

  async saveFile(storagePath: string, content: Buffer) {
    const absolutePath = this.resolvePath(storagePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);

    return {
      storage_path: storagePath,
      absolute_path: absolutePath,
    };
  }

  async readFile(storagePath: string) {
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
      content: await readFile(absolutePath),
    };
  }

  async ensureWritable() {
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

  private resolvePath(storagePath: string) {
    const normalized = storagePath.replace(/^\/+/, '');
    return join(this.localRoot, normalized);
  }
}
