import { describe, it, expect, vi } from 'vitest';
import { askNouls, TypeSafeError } from './system-one.js';

const request = { model: 'jev-1.14.0', state: { box: 'Holiday Inn' }, questions: { place: { type: 'noul' as const, instructions: 'Does the guest name a place?' } } };
const ok = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

describe('askNouls', () => {
  it('posts the request with the bearer key and returns each probability', async () => {
    const fetchImpl = ok({ model: 'jev-1.14.0', answers: { place: { type: 'noul', noul: 0.97 } }, usage: { input_tokens: 40, output_tokens: 1 } });
    const result = await askNouls('key-123', request, fetchImpl as any);
    expect(result).toEqual({ model: 'jev-1.14.0', answers: { place: 0.97 }, inputTokens: 40 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.headers.Authorization).toBe('Bearer key-123');
    expect(JSON.parse(init.body)).toEqual(request);
  });

  it('throws on an HTTP error instead of returning an answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"detail":"rate limited"}', { status: 429 }));
    await expect(askNouls('key-123', request, fetchImpl as any)).rejects.toMatchObject({ name: 'TypeSafeError', status: 429 });
  });

  it('throws when the network call fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { name: 'TimeoutError' }));
    await expect(askNouls('key-123', request, fetchImpl as any)).rejects.toBeInstanceOf(TypeSafeError);
  });

  it('throws when an answer is missing or not a probability', async () => {
    await expect(askNouls('key-123', request, ok({ model: 'm', answers: {} }) as any)).rejects.toBeInstanceOf(TypeSafeError);
    await expect(askNouls('key-123', request, ok({ model: 'm', answers: { place: { type: 'noul', noul: 'yes' } } }) as any)).rejects.toBeInstanceOf(TypeSafeError);
  });
});
