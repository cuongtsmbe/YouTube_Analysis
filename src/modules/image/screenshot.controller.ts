import { Controller, Get, Param, Res, NotFoundException } from "@nestjs/common";
import { Response } from "express";
import * as fs from "fs";
import * as path from "path";

@Controller("screenshots")
export class ScreenshotController {
  private screenshotDir = path.join(process.cwd(), "screenshots");

  @Get(":jobId")
  getScreenshot(@Param("jobId") jobId: string, @Res() res: Response) {
    const screenshotPath = path.join(this.screenshotDir, `${jobId}.png`);

    if (!fs.existsSync(screenshotPath)) {
      throw new NotFoundException("Screenshot not found");
    }

    return res.sendFile(screenshotPath);
  }
}
