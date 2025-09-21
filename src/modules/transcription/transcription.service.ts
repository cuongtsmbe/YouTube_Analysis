/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import * as fs from "fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

@Injectable()
export class TranscriptionService {
  private readonly elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
  private readonly gptZeroApiKey = process.env.GPT_ZERO_API_KEY;
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly elevenlabs: ElevenLabsClient;

  constructor() {
    if (!process.env.ELEVEN_LABS_API_KEY) {
      throw new Error("Missing ELEVEN_LABS_API_KEY in env");
    }
    this.elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVEN_LABS_API_KEY,
    });
  }

  async transcribeAudio(audioPath: string): Promise<any> {
    this.logger.log(`Transcribing audio at path: ${audioPath}`);

    try {
      const buffer = fs.readFileSync(audioPath);

      const transcription = await this.elevenlabs.speechToText.convert({
        file: new Blob([buffer], { type: "audio/wav" }),
        modelId: "scribe_v1",
        diarize: true,
        tagAudioEvents: true,
        timestampsGranularity: "word",
      });

      const normalized = this.normalizeTranscription(transcription);
      this.logger.log("Transcription completed successfully");
      return normalized;
    } catch (error) {
      this.logger.error("Transcription failed:", error);
      throw error;
    }
  }

  private normalizeTranscription(transcription: any): any {
    if (Array.isArray(transcription.segments)) {
      return transcription;
    }

    const segments: any[] = [];
    let currentSpeaker: string | null = null;
    let currentText: string[] = [];
    let startTime: number | null = null;

    for (const word of transcription.words ?? []) {
      if (word.speaker !== currentSpeaker) {
        if (currentText.length) {
          segments.push({
            speaker: currentSpeaker,
            text: currentText.join(" "),
            start: startTime,
            end: word.start,
          });
        }
        currentSpeaker = word.speaker;
        currentText = [];
        startTime = word.start;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      currentText.push(word.word);
    }

    if (currentText.length) {
      segments.push({
        speaker: currentSpeaker,
        text: currentText.join(" "),
        start: startTime,
        end: transcription.words?.[transcription.words.length - 1]?.end,
      });
    }

    return {
      ...transcription,
      segments,
    };
  }

  async analyzeWithGPTZero(transcription: any): Promise<any> {
    const analyzedSegments = [];

    for (const segment of transcription.segments) {
      let aiProbability: number | null = null;

      if (this.gptZeroApiKey) {
        try {
          const response = await axios.post(
            "https://api.gptzero.me/v2/predict/text",
            {
              document: segment.text,
            },
            {
              headers: {
                "x-api-key": this.gptZeroApiKey,
                "Content-Type": "application/json",
              },
            },
          );

          aiProbability = response.data.documents[0].ai_probability;
        } catch (error) {
          console.error(`GPTZero failed for: ${segment.text}`, error);
          aiProbability = null;
        }
      } else {
        // If no GPTZero key, assign random probability for testing
        aiProbability = Math.random();
      }

      analyzedSegments.push({
        ...segment,
        ai_probability: aiProbability,
      });
    }

    return {
      ...transcription,
      segments: analyzedSegments,
    };
  }
}
