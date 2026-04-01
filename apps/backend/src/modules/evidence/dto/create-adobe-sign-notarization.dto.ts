import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAdobeSignNotarizationDto {
  @IsString()
  @IsNotEmpty()
  evidence_id!: string;

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
  @IsNotEmpty()
  file_hash!: string;
}
