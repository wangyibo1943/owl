import { Body, Controller, Post } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditLookupDto } from './dto/credit-lookup.dto';

@Controller('credit')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Post('lookup')
  lookup(@Body() payload: CreditLookupDto) {
    return this.creditService.lookup(payload);
  }
}

