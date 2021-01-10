import { Controller, Post, Body } from '@nestjs/common';
import { HookReqDto } from './dto/HookReqDto';
import { HookService } from './hook.service';

@Controller('hook')
export class HookController {

  constructor(private hookService: HookService) {}

  @Post()
  create(@Body() req: HookReqDto): string {    
    console.log(req)
    this.hookService.start(req)
    return "req";
  }
  
}
