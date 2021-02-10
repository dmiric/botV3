import { Module } from '@nestjs/common';
import { InputModule } from '../input/input.module';
import { LogService } from './log.service';

@Module({
    imports: [InputModule],
    controllers: [],
    providers: [LogService],
    exports: [LogService],
})
export class LogModule {}
