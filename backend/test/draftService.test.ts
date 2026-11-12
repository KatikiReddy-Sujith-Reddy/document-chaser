import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftService, renderTemplate, type DraftPromptInput } from "../src/services/draftService.js";

const input: DraftPromptInput = {
  caseId: "CS-1041",
  clientName: "Lumen Textiles Ltd",
  rmName: "A. Patel",
  items: [
    { label: "Beneficial ownership register", reason: "Required to document ownership and control." },
    { label: "Register of directors", reason: "Must be dated within the last 90 days." },
  ],
  responseDate: "2026-11-20",
};

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  vi.restoreAllMocks();
});

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

describe("draft service", () => {
  it("uses the template when both key variables are unset", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const generator = vi.fn(async () => renderTemplate(input));
    const service = createDraftService({ apiKey: undefined, model: "gemini-2.5-flash" }, generator);

    const draft = await service(input);

    expect(draft.source).toBe("template");
    expect(generator).not.toHaveBeenCalled();
    expect(draft.body.match(/November 20, 2026/g)).toHaveLength(1);
    expect(draft.body.match(/Beneficial ownership register/g)).toHaveLength(1);
    expect(draft.body.match(/Register of directors/g)).toHaveLength(1);
  });

  it("accepts a valid model draft without making a real network call", async () => {
    const generator = vi.fn(async () => renderTemplate(input));
    const service = createDraftService({ apiKey: "test-only-placeholder", model: "gemini-2.5-flash" }, generator);

    const draft = await service(input);

    expect(draft.source).toBe("gemini");
    expect(generator).toHaveBeenCalledOnce();
    expect(draft.body).toContain("Must be dated within the last 90 days.");
  });

  it("falls back after an invalid model response", async () => {
    const invalid = renderTemplate(input).replace("Register of directors:", "Another document:");
    const service = createDraftService(
      { apiKey: "test-only-placeholder", model: "gemini-2.5-flash" },
      async () => invalid,
    );

    expect((await service(input)).source).toBe("template");
  });

  it("falls back on timeout and aborts the request", async () => {
    let signal: AbortSignal | undefined;
    const service = createDraftService(
      { apiKey: "test-only-placeholder", model: "gemini-2.5-flash", timeoutMs: 5 },
      ({ abortSignal }) => {
        signal = abortSignal;
        return new Promise<string>(() => {});
      },
    );

    const draft = await service(input);

    expect(draft.source).toBe("template");
    expect(signal?.aborted).toBe(true);
  });

  it("falls back on generator errors", async () => {
    const service = createDraftService(
      { apiKey: "test-only-placeholder", model: "gemini-2.5-flash" },
      async () => {
        throw new Error("mock failure");
      },
    );

    expect((await service(input)).source).toBe("template");
  });
});
