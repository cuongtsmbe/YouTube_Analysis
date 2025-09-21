/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import * as fs from "fs";
import * as path from "path";
import { StorageService } from "src/modules/storage/storage.service";

interface TwoCaptchaSolver {
  recaptcha(options: {
    pageurl: string;
    googlekey: string;
  }): Promise<{ data: string }>;
}

@Injectable()
export class PuppeteerUtils {
  private cluster: Cluster;
  private solver: TwoCaptchaSolver | null = null;
  private readonly logger = new Logger(PuppeteerUtils.name);

  constructor(private storageService: StorageService) {
    this.initCluster().catch((error) => {
      this.logger.error("Failed to initialize cluster:", error);
    });

    if (process.env.TWO_CAPTCHA_API_KEY) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const twocaptcha = require("@2captcha/captcha-solver");
        this.solver = new twocaptcha.Solver(process.env.TWO_CAPTCHA_API_KEY);
        this.logger.log("2Captcha solver initialized");
      } catch (error: any) {
        this.logger.warn(
          "2Captcha library not available, CAPTCHA solving will be disabled",
          error.message,
        );
      }
    }
  }

  private async initCluster() {
    try {
      this.cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,
        puppeteerOptions: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--window-size=1280,720",
          ],
        },
        timeout: 100 * 60 * 1000,
        retryLimit: 1,
        monitor: false,
      });

      await this.cluster.task(async ({ page, data: { url, jobId } }) => {
        this.logger.log(`Processing job ${jobId} for URL: ${url}`);

        try {
          await page.setViewport({ width: 1280, height: 720 });
          await page.emulate({
            viewport: {
              width: 1280,
              height: 720,
            },
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          });

          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });

          await page.waitForSelector("body", { timeout: 30000 });

          try {
            if (await this.detectCaptcha(page)) {
              await this.solveCaptcha(page);
            }
          } catch (captchaError) {
            this.logger.warn(
              `CAPTCHA handling failed: ${captchaError.message}`,
            );
          }

          try {
            await this.handleCookieConsent(page);
          } catch (cookieError) {
            this.logger.warn(
              `Cookie consent handling failed: ${cookieError.message}`,
            );
          }

          await this.playVideo(page);

          await new Promise((resolve) => setTimeout(resolve, 5000));

          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const screenshotPath = await this.takeScreenshot(page, jobId);

          const videoInfo = await this.getVideoInfo(page);

          return { screenshotPath, videoInfo };
        } catch (error) {
          this.logger.error(
            `Error during YouTube analysis for job ${jobId}:`,
            error,
          );
          throw new Error(`Failed to analyze YouTube video: ${error.message}`);
        }
      });

      this.logger.log("Puppeteer cluster initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize puppeteer cluster:", error);
      throw error;
    }
  }

  private async playVideo(page: puppeteer.Page): Promise<void> {
    const playSelectors = [
      ".ytp-play-button",
      "button.ytp-play-button",
      ".ytp-large-play-button",
      "button.ytp-large-play-button",
      ".ytp-play-button[aria-label^='Play'], .ytp-play-button[aria-label^='Phát']",
      ".ytp-play-button[title^='Play'], .ytp-play-button[title^='Phát']",
      "#movie_player",
    ];

    try {
      const isVideoPlaying = await this.isVideoPlaying(page);
      if (isVideoPlaying) {
        this.logger.log("Video is already playing, no need to click play");
        return;
      }
    } catch (error) {
      this.logger.warn(`Could not check video status: ${error.message}`);
    }

    for (const selector of playSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          this.logger.log(`Clicked play button: ${selector}`);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const isNowPlaying = await this.isVideoPlaying(page);
          if (isNowPlaying) {
            this.logger.log("Video started playing successfully");
          } else {
            this.logger.warn("Video did not start playing after click");
          }

          return;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to click play button ${selector}: ${error.message}`,
        );
      }
    }

    this.logger.warn("Could not find any play button to click");
  }

  private async isVideoPlaying(page: puppeteer.Page): Promise<boolean> {
    try {
      const pauseSelectors = [
        '.ytp-play-button[title="Pause"]',
        '.ytp-play-button[aria-label="Pause"]',
        '.ytp-play-button[title^="Pause"]',
        '.ytp-play-button[aria-label^="Pause"]',

        '.ytp-play-button[title="Tạm dừng"]',
        '.ytp-play-button[aria-label="Tạm dừng"]',
        '.ytp-play-button[title^="Tạm dừng"]',
        '.ytp-play-button[aria-label^="Tạm dừng"]',

        '.ytp-play-button[title="Pausar"]',
        '.ytp-play-button[title="Pausa"]',
      ];

      for (const selector of pauseSelectors) {
        const pauseButton = await page.$(selector);
        if (pauseButton) {
          return true;
        }
      }

      const isPlaying = await page.evaluate(() => {
        const video = document.querySelector("video") as HTMLVideoElement;
        if (video) {
          return !video.paused && video.readyState > 2;
        }

        try {
          const player =
            (window as any).ytplayer || document.getElementById("movie_player");
          if (player && typeof player.getPlayerState === "function") {
            const state = player.getPlayerState();
            return state === 1;
          }
        } catch (e: any) {
          console.error("Could not access YouTube player API", e);
        }

        return false;
      });

      return isPlaying;
    } catch (error) {
      this.logger.warn(`Error checking video status: ${error.message}`);
      return false;
    }
  }

  private async takeScreenshot(
    page: puppeteer.Page,
    jobId: string,
    format: "png" | "jpeg" = "png",
  ): Promise<string> {
    const screenshotDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const extension = format === "jpeg" ? "jpg" : "png";
    const screenshotPath = path.join(screenshotDir, `${jobId}.${extension}`);

    try {
      const screenshotOptions: puppeteer.ScreenshotOptions = {
        path: screenshotPath as puppeteer.ScreenshotOptions["path"],
        fullPage: false,
        type: format,
      };

      if (format === "jpeg") {
        screenshotOptions.quality = 80;
      }

      await page.screenshot(screenshotOptions);
      this.logger.log(`Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      this.logger.error(`Failed to take screenshot: ${error.message}`);
      throw error;
    }
  }

  private async getVideoInfo(
    page: puppeteer.Page,
  ): Promise<{ title: string; channel: string }> {
    try {
      const videoInfo = await page.evaluate(() => {
        // Multiple selectors for title
        const titleSelectors = [
          "h1.ytd-watch-metadata",
          "h1.title",
          "h1 yt-formatted-string",
          ".title.style-scope.ytd-video-primary-info-renderer",
          "#container > h1",
          "ytd-watch-metadata h1",
          "ytd-watch-flexy h1",
        ];

        // Multiple selectors for channel
        const channelSelectors = [
          "ytd-channel-name #container #text",
          ".ytd-channel-name a",
          "#owner-container a",
          "#channel-name a",
          "ytd-video-owner-renderer a",
          ".ytd-channel-name yt-formatted-string",
          "#owner-sub-container a",
        ];

        let title = "Unknown title";
        let channel = "Unknown channel";

        // Find title
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            title = element.textContent.trim();
            break;
          }
        }

        // Find channel
        for (const selector of channelSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            channel = element.textContent.trim();
            break;
          }
        }

        return { title, channel };
      });

      this.logger.log(
        `Video info retrieved: ${videoInfo.title} by ${videoInfo.channel}`,
      );
      return videoInfo;
    } catch (error) {
      this.logger.warn(`Failed to get video info: ${error.message}`);
      return { title: "Unknown title", channel: "Unknown channel" };
    }
  }

  async analyzeYouTubeVideo(url: string, jobId: string): Promise<any> {
    try {
      return await this.cluster.execute({ url, jobId });
    } catch (error) {
      this.logger.error(`Cluster execution failed for job ${jobId}:`, error);
      throw error;
    }
  }

  private async detectCaptcha(page: puppeteer.Page): Promise<boolean> {
    const captchaSelectors = [
      "#captcha",
      'iframe[src*="captcha"]',
      'div[class*="captcha"]',
      "div[data-captcha]",
    ];

    for (const selector of captchaSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          this.logger.log(`CAPTCHA detected with selector: ${selector}`);
          return true;
        }
      } catch (error: any) {
        this.logger.warn(
          `Error detecting CAPTCHA with selector ${selector}: ${error.message}`,
        );
      }
    }

    return false;
  }

  private async solveCaptcha(page: puppeteer.Page): Promise<void> {
    if (!this.solver) {
      throw new Error("CAPTCHA detected but no 2Captcha API key provided");
    }

    try {
      const captchaIframe = await page.$('iframe[src*="captcha"]');
      if (!captchaIframe) {
        throw new Error("CAPTCHA iframe not found");
      }

      const captchaFrame = await captchaIframe.contentFrame();
      if (!captchaFrame) {
        throw new Error("Cannot access CAPTCHA iframe content");
      }

      const sitekey = await captchaFrame.$eval(".g-recaptcha", (el) =>
        el.getAttribute("data-sitekey"),
      );

      if (sitekey) {
        const { data: solution } = await this.solver.recaptcha({
          pageurl: page.url(),
          googlekey: sitekey,
        });

        await captchaFrame.evaluate((solution) => {
          const responseElement = document.getElementById(
            "g-recaptcha-response",
          );
          if (responseElement) {
            responseElement.innerHTML = solution;
            responseElement.dispatchEvent(new Event("change"));
          }
        }, solution);

        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.logger.log("CAPTCHA solved successfully");
      }
    } catch (error) {
      this.logger.error("CAPTCHA solving failed:", error);
      throw error;
    }
  }

  private async handleCookieConsent(page: puppeteer.Page): Promise<void> {
    const consentSelectors = [
      'button[aria-label="Accept all"]',
      "button.yt-spec-button-shape-next--call-to-action",
      'form[action="https://consent.youtube.com/s"] button',
      'button[aria-label="Accept the use of cookies and other data"]',
      "ytd-button-renderer ytd-consent-bump-v2-lightbox paper-button",
      "#content > div.body-wrapper > div.eom-buttons > ytd-button-renderer:nth-child(2) > a",
    ];

    for (const selector of consentSelectors) {
      try {
        const element = await page
          .waitForSelector(selector, { timeout: 3000 })
          .catch(() => null);
        if (element) {
          await element.click();
          this.logger.log(`Clicked cookie consent: ${selector}`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to handle cookie consent with selector ${selector}: ${error.message}`,
        );
      }
    }

    this.logger.warn("No cookie consent button found");
  }
}
