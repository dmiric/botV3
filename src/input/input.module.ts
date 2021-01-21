import { Module } from '@nestjs/common';
import { ApiKeyService } from './apikey.service';

@Module({
    imports: [],
    controllers: [],
    providers: [ApiKeyService],
    exports: [ApiKeyService],
})
export class InputModule {}
