import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { AnalyzeController } from "./analyze.controller";
import { AnalyzeService } from "./analyze.service";
import { AnalyzeProcessor } from "./analyze.processor";
import { TranscriptionService } from "../transcription/transcription.service";
import { PuppeteerUtils } from "src/shared/utils/puppeteer.utils";
import { StorageService } from "../storage/ storage.service";
import { FfmpegUtils } from "src/shared/utils/ffmpeg.utils";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "analysis",
    }),
  ],
  controllers: [AnalyzeController],
  providers: [
    AnalyzeService,
    AnalyzeProcessor,
    PuppeteerUtils,
    FfmpegUtils,
    TranscriptionService,
    StorageService,
  ],
})
export class AnalyzeModule {}
