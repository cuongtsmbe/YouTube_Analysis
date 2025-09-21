import { IsString, IsUrl, Matches } from "class-validator";

export class AnalyzeRequestDto {
  @IsUrl()
  @IsString()
  @Matches(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/, {
    message: "URL must be a valid YouTube URL",
  })
  url: string;
}
