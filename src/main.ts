Object.assign(global, { WebSocket: require('ws') });

import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston'
import * as winston from 'winston';

import { ConfigService } from './config/config.service'
import { ConfigModule } from './config/config.module'

import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            nestWinstonModuleUtilities.format.nestLike(),
          ),
        }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        // other transports...
      ],
      // options (same as WinstonModule.forRoot() options)
    })
  });

  app.useStaticAssets(join(__dirname, '../', 'public'));
  app.setBaseViewsDir(join(__dirname, '../', 'views'));
  app.setViewEngine('hbs');

  const config = app.select(ConfigModule).get(ConfigService, { strict: true })
  const port = config.getPort()

  await app.listen(port);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();