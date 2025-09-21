import { Module } from "@nestjs/common";
import { ScreenshotController } from "./screenshot.controller";

@Module({
  controllers: [ScreenshotController],
})
export class ScreenshotModule {}
