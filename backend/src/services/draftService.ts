import {
  generateGeminiText,
  type DraftPromptInput,
  type GeminiRequest,
} from "./geminiClient.js";

export type { DraftPromptInput } from "./geminiClient.js";

export type Draft = {
  subject: string;
  body: string;
  source: "gemini" | "template";
};

export type DraftServiceOptions = {
  apiKey: string | undefined;
  model: string;
  timeoutMs?: number;
};

export type DraftGenerator = (request: GeminiRequest) => Promise<string>;

const DATE_PATTERN =
  /\b(?:\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
const FORBIDDEN_JUDGMENT_PATTERN = /\b(?:authentic(?:ity)?|genuine|forged|fraud(?:ulent)?)\b/i;
const LIST_LINE_PATTERN = /^\s*(?:[-*]\s+|\d+[.)]\s+).+$/gm;

function displayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Draft responseDate must be a valid YYYY-MM-DD date");
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function countOccurrences(text: string, value: string): number {
  if (!value) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.toLocaleLowerCase().indexOf(value.toLocaleLowerCase(), offset);
    if (index < 0) return count;
    count += 1;
    offset = index + value.length;
  }
}

export function renderTemplate(input: DraftPromptInput): string {
  const lines = input.items.map((item) => `- ${item.label}: ${item.reason}`).join("\n");
  return [
    `Subject: Documents requested for ${input.caseId}`,
    "Body:",
    `Hello ${input.clientName},`,
    "",
    "Please provide the following items to complete our review:",
    lines,
    "",
    `Please send these items by ${displayDate(input.responseDate)}.`,
    "",
    "Kind regards,",
    input.rmName,
  ].join("\n");
}

function parseDraft(text: string): Omit<Draft, "source"> | null {
  const subjectLines = text.match(/^Subject:\s*(.+)$/gim) ?? [];
  const bodyHeaders = text.match(/^Body:\s*$/gim) ?? [];
  if (subjectLines.length !== 1 || bodyHeaders.length !== 1) return null;

  const subject = subjectLines[0].replace(/^Subject:\s*/i, "").trim();
  const bodyStart = text.search(/^Body:\s*$/im);
  const body = text.slice(bodyStart).replace(/^Body:\s*\r?\n?/i, "").trim();
  if (!subject || !body) return null;
  return { subject, body };
}

function isValidDraft(text: string, input: DraftPromptInput): Omit<Draft, "source"> | null {
  const parsed = parseDraft(text);
  if (!parsed) return null;

  const fullText = `${parsed.subject}\n${parsed.body}`;
  if (fullText.split(/\s+/).filter(Boolean).length > 150) return null;
  if (FORBIDDEN_JUDGMENT_PATTERN.test(fullText)) return null;

  const dateMatches = fullText.match(DATE_PATTERN) ?? [];
  const expectedDate = displayDate(input.responseDate);
  if (dateMatches.length !== 1 || dateMatches[0] !== expectedDate) return null;

  const listLines = parsed.body.match(LIST_LINE_PATTERN) ?? [];
  if (listLines.length !== input.items.length) return null;
  for (const item of input.items) {
    if (countOccurrences(parsed.body, item.label) !== 1) return null;
    if (countOccurrences(parsed.body, item.reason) !== 1) return null;
    const line = listLines.find((candidate) => candidate.toLocaleLowerCase().includes(item.label.toLocaleLowerCase()));
    if (!line || !line.includes(item.reason)) return null;
  }
  return parsed;
}

function reportFallback(category: "missing_key" | "timeout" | "generation_error" | "validation_failure") {
  console.warn(`[draft] Template fallback: ${category}`);
}

export function createDraftService(
  options: DraftServiceOptions,
  generate: DraftGenerator = generateGeminiText,
): (input: DraftPromptInput) => Promise<Draft> {
  const timeoutMs = options.timeoutMs ?? 8000;

  return async (input) => {
    const template = parseDraft(renderTemplate(input));
    if (!template) throw new Error("The generated template draft was invalid");

    if (!options.apiKey?.trim()) {
      reportFallback("missing_key");
      return { ...template, source: "template" };
    }

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error("draft_timeout"));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([
        generate({
          apiKey: options.apiKey,
          model: options.model,
          input,
          abortSignal: abortController.signal,
          timeoutMs,
        }),
        timeout,
      ]);
      const validated = isValidDraft(response, input);
      if (!validated) {
        reportFallback("validation_failure");
        return { ...template, source: "template" };
      }
      return { ...validated, source: "gemini" };
    } catch {
      reportFallback(abortController.signal.aborted ? "timeout" : "generation_error");
      return { ...template, source: "template" };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
}
