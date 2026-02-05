import { openai } from "./llm";
import { createReadStream } from "fs";

export interface TranscriptionOptions {
  filePath: string;
  language?: string;
  prompt?: string;
  model?: string;
}

export async function transcribeAudio(
  options: TranscriptionOptions
): Promise<{ text: string }> {
  const { filePath, language, prompt, model = "whisper-1" } = options;

  const response = await openai.audio.transcriptions.create({
    file: createReadStream(filePath),
    model,
    language,
    prompt,
  });

  return { text: response.text };
}
