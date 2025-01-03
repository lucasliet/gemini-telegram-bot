import { addChatToHistory, getChatHistory } from "../repository/ChatRepository.ts";
import { convertGeminiHistoryToGPT, replaceGeminiConfigFromTone } from "../util/ChatConfigUtil.ts";
import { cloudflareModels } from '../config/models.ts'; 
import { downloadTelegramFile } from "./TelegramService.ts";

const CLOUDFLARE_ACCOUNT_ID: string = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') as string;
const CLOUDFLARE_API_KEY: string = Deno.env.get('CLOUDFLARE_API_KEY') as string;

const { imageModel, textModel, visionTextModel, sqlModel, codeModel, sttModel } = cloudflareModels;

const cloudFlareMaxTokens = 1000;

const requestOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`
  }
};

export default {
  async generateTextResponseFromImage(userKey: string, quote: string = '', photoUrl: Promise<string>, prompt: string): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `"${quote}" ${prompt}`: prompt;

    const photoBinaryArray = await downloadTelegramFile(await photoUrl);

    const apiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${visionTextModel}`, {
      ...requestOptions,
      body: JSON.stringify({
        prompt: requestPrompt,
        image: Array.from(photoBinaryArray),
        max_tokens: cloudFlareMaxTokens
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
    }
    const { result: { description } } = await apiResponse.json();

    addChatToHistory(geminiHistory, quote, requestPrompt, description, userKey);

    return description;
  },
  async generateText(userKey: string, quote: string = '', prompt: string, model: string = textModel): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `"${escapeMessageQuotes(quote)}" ${escapeMessageQuotes(prompt)}` : escapeMessageQuotes(prompt);

    const apiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
      ...requestOptions,
      body: JSON.stringify({
        messages: [
          { role: "system", content: replaceGeminiConfigFromTone('Llama', textModel, cloudFlareMaxTokens) },
          ...convertGeminiHistoryToGPT(geminiHistory),
          { role: "user", content: requestPrompt }
        ], max_tokens: cloudFlareMaxTokens
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
    }

    const { result: { response } } = await apiResponse.json();

    addChatToHistory(geminiHistory, quote, requestPrompt, response, userKey);

    return response;
  },
  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`, {
      ...requestOptions,
      body: `{"prompt": "${escapeMessageQuotes(prompt)}"}`
    });

    if (!response.ok) {
      console.error(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`,
        { ...requestOptions, body: `{"prompt": "${escapeMessageQuotes(prompt)}"}` },
        response.statusText
      )
      throw new Error(`Failed to generate image: ${response.statusText}}`);
    }
    return await response.arrayBuffer();
  },
  async generateSQL(userKey: string, quote: string = '', prompt: string): Promise<string> {
    return await this.generateText(userKey, quote, prompt, sqlModel);
  },
  async generateCode(userKey: string, quote: string = '', prompt: string): Promise<string> {
    return await this.generateText(userKey, quote, prompt, codeModel);
  },
  async transcribeAudio(audioFile: Promise<Uint8Array>): Promise<string> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${sttModel}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`
      },
      body: await audioFile
    });

    if (!response.ok) {
      throw new Error(`Failed to transcribe text: ${response.statusText}`);
    }

    const { result: { text } } = await response.json();

    return text;
  },
}

function escapeMessageQuotes(message: string): string {
  return message.replace(/"/g, '\\"');
}


