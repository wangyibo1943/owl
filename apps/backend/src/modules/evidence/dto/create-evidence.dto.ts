import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEvidenceDto {
  @IsString()
  @IsNotEmpty()
  company_name!: string;

  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  mime_type!: string;

  @IsString()
  @IsNotEmpty()
  file_content_base64!: string;

  @IsString()
  deal_reference!: string;
}

