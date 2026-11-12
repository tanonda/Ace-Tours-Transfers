// Minimal client for TypeSafe's System One endpoint (POST /v1/systemone), using the built-in fetch.
// The official SDK needs Node 22; the Docker builder stage is Node 20, so this calls the HTTP API directly.
// A failed call always throws: callers must never read a failure as a "no".

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TIMEOUT_MS = 10_000;

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};

export type SystemOneRequest = {
  model: string;
  state: unknown;
  questions: Record<string, NoulQuestion>;
};

export type NoulAnswers<Id extends string> = Record<Id, number>;

export type SystemOneResult<Id extends string> = {
  /** The versioned model that answered, e.g. "jev-1.14.0". */
  model: string;
  answers: NoulAnswers<Id>;
  inputTokens: number | null;
};

export class TypeSafeError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "TypeSafeError";
  }
}

/** Ask a set of yes/no questions. Returns the probability of "yes" for each question id. */
export async function askNouls<Id extends string>(
  apiKey: string,
  request: SystemOneRequest & { questions: Record<Id, NoulQuestion> },
  fetchImpl: typeof fetch = fetch,
): Promise<SystemOneResult<Id>> {
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    throw new TypeSafeError(`TypeSafe request did not complete: ${err?.name ?? "Error"}`);
  }
  if (!res.ok) {
    // The error body can echo request content, so only the status is kept.
    throw new TypeSafeError(`TypeSafe returned HTTP ${res.status}`, res.status);
  }

  const body = (await res.json()) as any;
  const answers = {} as NoulAnswers<Id>;
  for (const id of Object.keys(request.questions) as Id[]) {
    const p = body?.answers?.[id]?.noul;
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) {
      throw new TypeSafeError(`TypeSafe response has no usable answer for "${id}"`);
    }
    answers[id] = p;
  }
  return {
    model: typeof body?.model === "string" ? body.model : request.model,
    answers,
    inputTokens: typeof body?.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
  };
}
