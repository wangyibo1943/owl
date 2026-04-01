import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RecordNotarizationResultDto {
  @IsString()
  @IsNotEmpty()
  provider_name!: string;

  @IsOptional()
  @IsString()
  provider_certificate_id?: string;

  @IsOptional()
  @IsString()
  certificate_url?: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsObject()
  provider_payload?: Record<string, unknown>;
}
