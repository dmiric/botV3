import { Controller, Post, Body, Put } from '@nestjs/common';
import { HookReqDto } from './dto/HookReqDto';
import { HookService } from './hook.service';

@Controller('hook')
export class HookController {

  constructor(private hookService: HookService) {}

  @Post()
  async create(@Body() req: HookReqDto): Promise<string> {    
    console.log('create')
    await this.hookService.newLong(req)
    return "create";
  }

  @Put()
  async update(@Body() req: HookReqDto): Promise<string> {    
    console.log('update')
    await this.hookService.updateLong(req)
    return "update";
  }
  
}
