import type { z } from "zod";
import { SourceError, USER_AGENT, type Fetch } from "../types";

// Fetches JSON and validates it, so a provider changing its response shape fails loudly
export const fetchJson = async <T>(
  fetchFn: Fetch,
  source: string,
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> => {
  let response: Response;
  try {
    response = await fetchFn(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    // Node's "fetch failed" hides the reason in `cause`; the URL stays out of the message
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    const reason = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error));
    throw new SourceError(`${source} request failed: ${reason}`);
  }
  // Never include the URL or body: some providers put the key in the URL
  if (!response.ok) throw new SourceError(`${source} returned HTTP ${response.status}`, response.status);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SourceError(
      `${source} response didn't match the expected shape at ${issue?.path.join(".") || "(root)"}: ${issue?.message}`,
    );
  }
  return parsed.data;
};

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

// Collapses HTML and whitespace in descriptions and snippets. Entities are decoded before and
// after removing tags, because Greenhouse escapes its (already escaped) HTML once more.
export const plainText = (value: string | null | undefined) =>
  value
    ? decodeEntities(decodeEntities(value).replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim() || null
    : null;

export const REMOTE_PATTERN = /\b(remote|work from home|wfh)\b/i;
