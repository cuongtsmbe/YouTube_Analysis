/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { PuppeteerUtils } from "src/shared/utils/puppeteer.utils";
import { TranscriptionService } from "../transcription/transcription.service";
import { StorageService } from "../storage/storage.service";
import { FfmpegUtils } from "src/shared/utils/ffmpeg.utils";
import { Logger } from "@nestjs/common";

@Processor("analysis")
export class AnalyzeProcessor {
  private readonly logger = new Logger(AnalyzeProcessor.name);

  constructor(
    private puppeteerUtils: PuppeteerUtils,
    private ffmpegUtils: FfmpegUtils,
    private transcriptionService: TranscriptionService,
    private storageService: StorageService,
  ) {}

  @Process("process")
  async handleAnalysis(job: Job) {
    const { youtubeUrl, jobId } = job.data;
    this.logger.log(`Starting analysis for job ${jobId} on URL: ${youtubeUrl}`);

    try {
      this.logger.log(`Analyzing YouTube video: ${youtubeUrl}`);
      const { screenshotPath, videoInfo } =
        await this.puppeteerUtils.analyzeYouTubeVideo(youtubeUrl, jobId);

      this.logger.log(`Video info retrieved: ${videoInfo.title}`);
      const audioPath = await this.ffmpegUtils.downloadAndProcessAudio(
        youtubeUrl,
        jobId,
      );

      this.logger.log(`Audio downloaded and processed: ${audioPath}`);
      const transcription =
        await this.transcriptionService.transcribeAudio(audioPath);

      this.logger.log(
        `Transcription completed, length: ${transcription.segments.length} segments`,
      );
      const analyzedTranscription =
        await this.transcriptionService.analyzeWithGPTZero(transcription);

      const result = {
        jobId,
        youtubeUrl,
        videoInfo,
        screenshotPath,
        transcription: analyzedTranscription,
        createdAt: new Date().toISOString(),
      };

      this.logger.log(`Saving result for job ${jobId}`);
      await this.storageService.saveResult(jobId, result);

      this.logger.log(`Analysis completed for job ${jobId}`);
      return result;
    } catch (error) {
      console.error(`Analysis failed for job ${jobId}:`, error);
      throw error;
    }
  }
}
