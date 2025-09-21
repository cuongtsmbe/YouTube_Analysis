import { Controller, Post, Body, Get, Param } from "@nestjs/common";
import { AnalyzeService } from "./analyze.service";
import { AnalyzeRequestDto } from "./dto/analyze-request.dto";

@Controller("analyze")
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  async analyze(@Body() analyzeRequest: AnalyzeRequestDto) {
    return this.analyzeService.createAnalysisJob(analyzeRequest.url);
  }

  @Get("result/:id")
  async getResult(@Param("id") id: string) {
    return this.analyzeService.getAnalysisResult(id);
  }
}
