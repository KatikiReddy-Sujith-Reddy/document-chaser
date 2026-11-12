import { GoogleGenAI } from "@google/genai";

export const DRAFT_SYSTEM_PROMPT =
  "You write a client request email for a bank onboarding team. Use only the items in the gap list provided. Do not add, remove, or infer requirements. Do not judge whether any document is genuine, authentic, or fraudulent. List each item once on its own line with its reason. Include exactly one response date. Use a courteous tone and active voice. Keep the body under 150 words. Do not name any internal rule, score, or system. End with the RM name. Output a subject line and a body only.";

export type DraftPromptInput = {
  caseId: string;
  clientName: string;
  rmName: string;
  items: Array<{ label: string; reason: string }>;
  responseDate: string;
};

export type GeminiRequest = {
  apiKey: string;
  model: string;
  input: DraftPromptInput;
  abortSignal: AbortSignal;
  timeoutMs: number;
};

export async function generateGeminiText(request: GeminiRequest): Promise<string> {
  const client = new GoogleGenAI({
    apiKey: request.apiKey,
    httpOptions: { timeout: request.timeoutMs },
  });
  const response = await client.models.generateContent({
    model: request.model,
    contents: JSON.stringify(request.input),
    config: {
      systemInstruction: DRAFT_SYSTEM_PROMPT,
      temperature: 0.3,
      abortSignal: request.abortSignal,
      httpOptions: { timeout: request.timeoutMs },
    },
  });
  if (!response.text) throw new Error("empty_model_response");
  return response.text;
}
