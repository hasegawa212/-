import { openai } from "./llm";

export interface ImageGenerationOptions {
  prompt: string;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  model?: string;
}

export async function generateImage(
  options: ImageGenerationOptions
): Promise<{ url: string; revisedPrompt?: string }> {
  const {
    prompt,
    size = "1024x1024",
    quality = "standard",
    style = "vivid",
    model = "dall-e-3",
  } = options;

  const response = await openai.images.generate({
    model,
    prompt,
    n: 1,
    size,
    quality,
    style,
  });

  return {
    url: response.data[0].url || "",
    revisedPrompt: response.data[0].revised_prompt,
  };
}
