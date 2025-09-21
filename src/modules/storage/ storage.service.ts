import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class StorageService {
  private readonly storageDir = path.join(process.cwd(), "results");

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
            resolve(JSON.parse(data));
          } catch (parseError) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(parseError);
          }
        }
      });
    });
  }
}
