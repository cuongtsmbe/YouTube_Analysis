# YouTube Transcription Service

This project is a **Node.js service** that processes YouTube videos for transcription and AI analysis.  
It automates fetching a YouTube video, generating a thumbnail, extracting audio, transcribing speech, and detecting AI-generated content.

---

## Features

- **Submit YouTube URL** via REST API (`POST /analyze`) or simple web form.
- **Puppeteer**: loads the page, verifies playback, and takes a thumbnail screenshot.
- **ytdl-core + FFmpeg**: extracts audio and converts to WAV (16 kHz, mono, 16-bit).
- **ElevenLabs Scribe API**: generates transcription with word-level timestamps and speaker diarisation.
- **GPTZero API**: calculates `ai_probability` for each transcript segment.  
  ⚠️ Currently, no token is configured — mock data is returned for testing.
- **Job Queue**: processes requests asynchronously, returning a `jobId`.
- **Endpoints**:
  - `POST /analyze` → submit a job.
  - `GET /analyze/result/:jobId` → retrieve processed results (JSON transcript + metadata).
  - `GET /screenshots/:jobId` → view the video thumbnail.
- **Dockerized Deployment**: run with a single command on GCE VM or locally.

---

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/cuongtsmbe/YouTube_Analysis.git
cd YouTube_Analysis
```
### 2. ENV
```
    PORT=8080
    TWO_CAPTCHA_API_KEY=
    ELEVEN_LABS_API_KEY=sk_...
    GPT_ZERO_API_KEY=
    TZ=UTC
    REDIS_HOST=redis
    REDIS_PORT=6379
```
### 3. Run with Docker Compose
```
docker compose --env-file ./.env up -d --build

```

### API Usage
#### Submit a YouTube URL
Request: 
```
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=UcfOKyi5AM4"}'
```
Response:
```
{
  "jobId": "f8ab0348-02c3-4b14-81e4-c26b463f1995"
}

```

#### Get Analysis Result
Request: 
```
curl http://localhost:8080/analyze/result/f8ab0348-02c3-4b14-81e4-c26b463f1995

```
Example Response:
```
{
  "jobId": "f8ab0348-02c3-4b14-81e4-c26b463f1995",
  "youtubeUrl": "https://www.youtube.com/watch?v=UcfOKyi5AM4",
  "videoInfo": {
    "title": "ANH ĐỪNG ĐI XA QUÁ - LÁO SOÁI NHI ( OFFICIAL TEASER )",
    "channel": "Soái Nhi Official"
  },
  "screenshotPath": "/screenshots/f8ab0348-02c3-4b14-81e4-c26b463f1995.png",
  "transcription": {
    "languageCode": "vie",
    "languageProbability": 0.974957883358002,
    "text": "(âm nhạc) Anh đừng đi đâu quá xa, em nhé!",
    "words": [
      {
        "text": "(âm nhạc)",
        "start": 0.079,
        "end": 12.92,
        "type": "audio_event",
        "speakerId": "speaker_0",
        "logprob": 0
      },
      {
        "text": "xa,",
        "start": 15.079,
        "end": 16.459,
        "type": "word",
        "speakerId": "speaker_1",
        "logprob": 0
      },
      {
        "text": "nhé!",
        "start": 17.5,
        "end": 20.379,
        "type": "word",
        "speakerId": "speaker_1",
        "logprob": 0
      }
    ],
    "transcriptionId": "2zoiYpDbLs68OJssKpdJ",
    "segments": [
      {
        "text": "                ",
        "start": 0.079,
        "end": 20.379,
        "ai_probability": 0.875834158079275
      }
    ]
  },
  "createdAt": "2025-09-21T17:25:49.446Z"
}

```

#### Get Screenshot

Requesst: 
```
http://localhost:8080/screenshots/f8ab0348-02c3-4b14-81e4-c26b463f1995
```

### Video
Link: https://drive.google.com/file/d/1MqtuuLeVjj55ePituIXBm4MjKGgOGSaB/view

## Why Use a Job Queue?

Instead of processing synchronously in the request cycle:

- **Fast response for users** → they receive the `jobId` immediately without waiting for the processing to complete.
- **Better scalability** → long-running tasks (Puppeteer, FFmpeg, transcription) won’t block the API server.
- **Fault tolerance** → if a job fails, it can be retried without impacting API availability.
- **Clean architecture** → separates request handling (API) from heavy processing (workers).

---

👉 For **small systems with few users**, using a **job queue** (e.g., BullMQ in work queue mode) is sufficient to manage tasks.

👉 For **larger systems with many users and high throughput**, a **message queue** (e.g., Kafka, or RabbitMQ pub/sub) is recommended to provide better **scalability and distributed processing**.


