import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLegalTriggerDto {
  @IsString()
  @IsNotEmpty()
  evidence_id!: string;

  @IsString()
  @IsNotEmpty()
  seller_name!: string;

  @IsOptional()
  @IsEmail()
  seller_email?: string;

  @IsString()
  @IsNotEmpty()
  buyer_name!: string;

  @IsOptional()
  @IsEmail()
  buyer_email?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount_in_dispute?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  @IsNotEmpty()
  breach_summary!: string;

  @IsOptional()
  @IsString()
  lawyer_contact?: string;
}
