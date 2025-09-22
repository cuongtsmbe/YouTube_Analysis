import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";
import { AnalyzeModule } from "./modules/analyze/analyze.module";
import { ScreenshotModule } from "./modules/image/screenshot.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
