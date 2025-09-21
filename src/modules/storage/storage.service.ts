import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class StorageService {
  private readonly storageDir = path.join(process.cwd(), "results");
  private screenshotDir = path.join(process.cwd(), "screenshots");

  constructor() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async saveResult(jobId: string, result: any): Promise<void> {
    const filePath = path.join(this.storageDir, `${jobId}.json`);
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(result, null, 2), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getResult(jobId: string): Promise<any> {
    const filePath = path.join(this.storageDir, `${jobId}.json`);
    const screenshotPath = path.join(this.screenshotDir, `${jobId}.png`);

    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        reject(new Error("Result not found"));
        return;
      }

      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          reject(err);
        } else {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const result = JSON.parse(data);

            if (fs.existsSync(screenshotPath)) {
              result.screenshotPath = `/screenshots/${jobId}.png`;
            } else {
              result.screenshotPath = null;
            }

            resolve(result);
          } catch (parseError) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(parseError);
          }
        }
      });
    });
  }
}
