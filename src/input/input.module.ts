import { Module } from '@nestjs/common';
import { ApiKeyService } from './apikey.service';
import { ArgvService } from './argv.service';
import { ReadxlsService } from './readxls.service';

@Module({
    imports: [],
    controllers: [],
    providers: [ReadxlsService, ArgvService, ApiKeyService],
    exports: [ReadxlsService, ArgvService, ApiKeyService],
})
export class InputModule {}
