import { Module } from '@nestjs/common';
import { ApiKeyService } from './apikey.service';
import { ArgvService } from './argv.service';

@Module({
    imports: [],
    controllers: [],
    providers: [ArgvService, ApiKeyService],
    exports: [ArgvService, ApiKeyService],
})
export class InputModule {}
