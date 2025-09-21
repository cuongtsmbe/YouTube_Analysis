import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    @InjectQueue("analysis") private analysisQueue: Queue,
    private storageService: StorageService,
  ) {}

  async createAnalysisJob(youtubeUrl: string): Promise<{ jobId: string }> {
    const jobId: string = crypto.randomUUID();

    await this.analysisQueue.add("process", {
      youtubeUrl,
      jobId,
    });
    this.logger.log(`Job ${jobId} added to the queue for URL: ${youtubeUrl}`);

    return { jobId };
  }

  async getAnalysisResult(jobId: string): Promise<any> {
    return this.storageService.getResult(jobId);
  }
}
