import { Module } from '@nestjs/common';
import { ArgvService } from './argv.service';
import { ReadxlsService } from './readxls.service';

@Module({
    imports: [],
    controllers: [],
    providers: [ReadxlsService, ArgvService],
    exports: [ReadxlsService, ArgvService],
})
export class InputModule {}
