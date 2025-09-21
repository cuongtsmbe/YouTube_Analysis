import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import databaseConfig from "./config/database.config";
import { BullModule } from "@nestjs/bull";
import { AnalyzeModule } from "./modules/analyze/analyze.module";
import { ScreenshotModule } from "./modules/image/screenshot.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<Record<string, any>>("database");
        if (!config) {
          throw new Error("Database config not found");
        }
        return config;
      },
    }),

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || "redis",
        port: parseInt(process.env.REDIS_PORT ?? "6379") || 6379,
      },
    }),
    AnalyzeModule,
    ScreenshotModule,
  ],
  providers: [],
})
export class AppModule {}
