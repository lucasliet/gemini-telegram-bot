import { Content } from "npm:@google/generative-ai";
import OpenAi from 'npm:openai';
import GeminiService from "../service/GeminiService.ts";

export function convertGeminiHistoryToGPT(history: Content[]): OpenAi.Chat.Completions.ChatCompletionMessageParam[]{
  return history.map(content => {
    return {
      role: content.role === 'user' ? 'user' : 'assistant',
      content: content.parts.map(part => part.text).join(' ')
    };
  });
}

export function replaceGeminiConfigFromTone(chatName: string, model: string, maxTokens: number): string {
  return GeminiService.tone()
    .replace(/Gemini/gi, chatName)
    .replace(GeminiService.getModel(), model)
    .replace(`${GeminiService.buildGenerationConfig().maxOutputTokens}`, `${maxTokens}`);
}