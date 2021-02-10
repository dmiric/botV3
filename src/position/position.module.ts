import { PositionService } from './position.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './models/position.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Position]),
    ],
    controllers: [],
    providers: [
        PositionService, ],
})
export class PositionModule {

    
}
