import { Content } from "npm:@google/generative-ai";
import { getChatHistory } from "../repository/ChatRepository.ts";
import GeminiService from "./GeminiService.ts";

const CLOUDFLARE_ACCOUNT_ID: string = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') as string;
const CLOUDFLARE_API_KEY: string = Deno.env.get('CLOUDFLARE_API_KEY') as string;

const imageModel = '@cf/lykon/dreamshaper-8-lcm';
const textModel = '@cf/meta/llama-3-8b-instruct';
const sqlModel = '@cf/defog/sqlcoder-7b-2'
const codeModel = '@hf/thebloke/deepseek-coder-6.7b-instruct-awq';

const requestOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`
  }
};

export default {
  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`,{
        ...requestOptions,
        body: `{"prompt": "${prompt}"}`
    });
  
    if (!response.ok) {
      console.error(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`,
        {...requestOptions,body: `{"prompt": "${prompt}"}`},
        response.statusText
      )
      throw new Error(`Failed to generate image: ${response.statusText}}`);
    }
    return await response.arrayBuffer();
  },
  async generateText(userKey: string, quote: string = '', prompt: string, model: string = textModel): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);
  
    const apiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
      ...requestOptions,
      body: JSON.stringify({ 
        messages: [
          { role: "system", content: replaceGeminiConfigFromTone() },
          ...convertGeminiHistoryToCloudflareLlama(geminiHistory),
          { role: "user", content: `"${quote}" ${prompt}` }]
       })
    });
  
    if (!apiResponse.ok) {
      throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
    }
  
    const { result: { response } } = await apiResponse.json();
    return response;
  },
  async generateSQL(userKey: string, quote: string = '', prompt: string): Promise<string> {
    return await this.generateText(userKey, quote, prompt, sqlModel);
  },
  async generateCode(userKey: string, quote: string = '', prompt: string): Promise<string> {
    return await this.generateText(userKey, quote, prompt, codeModel);
  }
}

function replaceGeminiConfigFromTone() {
  return GeminiService.tone()
    .replace(/Gemini/gi, 'llama')
    .replace(GeminiService.getModel(), textModel)
    .replace(`${GeminiService.buildGenerationConfig().maxOutputTokens}`, `140`);
}

function convertGeminiHistoryToCloudflareLlama(history: Content[]) {
  return history.map(content => {
    return {
      role: content.role === 'user' ? 'user' : 'assistant',
      content: content.parts.map(part => part.text).join(' ')
    };
  });
}