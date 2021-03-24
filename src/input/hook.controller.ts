import { Controller, Post, Body } from '@nestjs/common';
import { HookReqDto } from './dto/HookReqDto';
import { HookService } from './hook.service';

@Controller('hook')
export class HookController {

  constructor(private hookService: HookService) {}

  @Post()
  async create(@Body() req: HookReqDto): Promise<string> {    
    console.log(req)
    await this.hookService.start(req)
    return "req";
  }
  
}
