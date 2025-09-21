/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from "@nestjs/common";
import * as ytdl from "ytdl-core";
import * as ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";
import { Readable } from "stream";

@Injectable()
export class FfmpegUtils {
  private readonly logger = new Logger(FfmpegUtils.name);

  constructor() {
    this.checkFfmpegAvailability();
  }

  private checkFfmpegAvailability(): void {
    try {
      execSync("ffmpeg -version", { stdio: "pipe" });
      this.logger.log("FFmpeg is available");
    } catch (error: any) {
      this.logger.error("FFmpeg is not installed or not in PATH");
      this.logger.error("Please install FFmpeg (apt/brew/download).");
      throw new Error(
        "FFmpeg not found. Please install FFmpeg on your system.",
      );
    }
  }

  /**
   * Download audio + convert to WAV (16kHz, mono, 16-bit)
   * Tries ytdl-core first; if it fails, fallbacks to yt-dlp binary.
   */
  async downloadAndProcessAudio(
    youtubeUrl: string,
    jobId: string,
  ): Promise<string> {
    const outputDir = path.join(process.cwd(), "audio");
    const outputPath = path.join(outputDir, `${jobId}.wav`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error("Invalid YouTube URL");
    }

    const runFfmpegFromStream = (stream: Readable): Promise<string> => {
      return new Promise((resolve, reject) => {
        try {
          const command = ffmpeg(stream)
            .inputOptions("-re")
            .audioFrequency(16000)
            .audioChannels(1)
            .audioCodec("pcm_s16le")
            .format("wav")
            .on("start", (cmdLine) =>
              this.logger.log(`FFmpeg start: ${cmdLine}`),
            )
            // .on("progress", (progress) => this.logger.log(`Processing`))
            .on("error", (err) => {
              this.logger.error("FFmpeg error:", err?.message ?? err);
              reject(err);
            })
            .on("end", () => {
              this.logger.log("Audio processing finished");
              resolve(outputPath);
            })
            .save(outputPath);
        } catch (err) {
          reject(err);
        }
      });
    };

    // First attempt: ytdl-core
    try {
      this.logger.log("Attempting to download with ytdl-core...");
      const audioStream = ytdl(youtubeUrl, {
        filter: "audioonly",
        quality: "highestaudio",
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          },
        },
        highWaterMark: 1 << 25,
      });

      return await runFfmpegFromStream(audioStream as unknown as Readable);
    } catch (ytdlErr: any) {
      this.logger.error(
        "ytdl-core download failed:",
        ytdlErr?.message ?? ytdlErr,
      );
      const msg = (ytdlErr?.message ?? "").toString().toLowerCase();
      if (
        msg.includes("could not extract functions") ||
        msg.includes("signature")
      ) {
        this.logger.log(
          "Falling back to yt-dlp binary for audio extraction...",
        );
        try {
          const args = [
            "-f",
            "bestaudio",
            "-o",
            "-",
            "--no-playlist",
            youtubeUrl,
          ];
          const yt = spawn("yt-dlp", args, {
            stdio: ["ignore", "pipe", "inherit"],
          });

          const stdout = yt.stdout;
          if (!stdout) throw new Error("yt-dlp did not provide stdout stream");

          // Ensure convert from whatever container/codec yt-dlp gives to desired wav spec
          return await runFfmpegFromStream(stdout as unknown as Readable);
        } catch (ytErr) {
          this.logger.error("yt-dlp fallback failed:", ytErr);
          throw new Error(`Both ytdl-core and yt-dlp failed: ${ytErr}`);
        }
      } else {
        throw ytdlErr;
      }
    }
  }
}
