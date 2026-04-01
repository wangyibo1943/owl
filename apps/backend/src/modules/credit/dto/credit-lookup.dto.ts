import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreditLookupDto {
  @IsString()
  company_name!: string;

  @IsOptional()
  @IsString()
  company_state?: string;

  @IsOptional()
  @IsString()
  ein?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}
