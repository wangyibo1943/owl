import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Database writes will be skipped.',
      );
      return;
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  isEnabled() {
    return this.client !== null;
  }

  async insert<T extends Record<string, unknown>>(
    table: string,
    payload: Record<string, unknown>,
  ) {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from(table)
      .insert(payload)
      .select()
      .maybeSingle<T>();

    if (error) {
      this.logger.error(`Failed to insert into ${table}: ${error.message}`);
      return null;
    }

    return data ?? null;
  }

  async update(
    table: string,
    match: Record<string, unknown>,
    payload: Record<string, unknown>,
  ) {
    if (!this.client) return;

    const { error } = await this.client.from(table).update(payload).match(match);

    if (error) {
      this.logger.error(`Failed to update ${table}: ${error.message}`);
    }
  }

  async findFirst<T extends Record<string, unknown>>(
    table: string,
    match: Record<string, unknown>,
    options?: {
      orderBy?: string;
      ascending?: boolean;
    },
  ) {
    if (!this.client) return null;

    let query = this.client.from(table).select('*').match(match);

    if (options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.ascending ?? false,
      });
    }

    const { data, error } = await query.limit(1).maybeSingle<T>();

    if (error) {
      this.logger.error(`Failed to query ${table}: ${error.message}`);
      return null;
    }

    return data ?? null;
  }
}
