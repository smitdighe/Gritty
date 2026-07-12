import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from './client';
import { GrittyApiError, CLIENT_ERROR_CODES } from './GrittyApiError';

let client = createClient();
let mock = new MockAdapter(client);

beforeEach(() => {
  client = createClient();
  mock = new MockAdapter(client);
});
afterEach(() => {
  mock.reset();
});

describe('client interceptor', () => {
  it('surfaces a 404 GrittyError body as a typed GrittyApiError', async () => {
    mock.onGet('/status').reply(404, {
      error: { code: 'NotARepo', message: 'not a gritty repository' },
    });

    const err = await client.get('/status').catch((e) => e);
    expect(err).toBeInstanceOf(GrittyApiError);
    expect(err.code).toBe('NotARepo');
    expect(err.message).toBe('not a gritty repository');
    expect(err.status).toBe(404);
    expect(err.isNetworkError).toBe(false);
  });

  it('preserves the backend code on a 400 UsageError', async () => {
    mock.onPost('/commits').reply(400, {
      error: { code: 'UsageError', message: 'nothing to commit' },
    });
    const err = await client.post('/commits', { message: '' }).catch((e) => e);
    expect(err).toBeInstanceOf(GrittyApiError);
    expect(err.code).toBe('UsageError');
    expect(err.status).toBe(400);
  });

  it('does NOT retry on a 4xx (handler called exactly once)', async () => {
    let calls = 0;
    mock.onGet('/status').reply(() => {
      calls += 1;
      return [404, { error: { code: 'NotARepo', message: 'x' } }];
    });
    await client.get('/status').catch((e) => e);
    expect(calls).toBe(1);
  });

  it('retries once on a network failure, then succeeds', async () => {
    mock.onGet('/health').networkErrorOnce();
    mock.onGet('/health').reply(200, { ok: true });
    const res = await client.get('/health');
    expect(res.data).toEqual({ ok: true });
  });

  it('throws a typed NetworkError when the network stays down', async () => {
    mock.onGet('/health').networkError();
    const err = await client.get('/health').catch((e) => e);
    expect(err).toBeInstanceOf(GrittyApiError);
    expect(err.code).toBe(CLIENT_ERROR_CODES.Network);
    expect(err.isNetworkError).toBe(true);
  });

  it('wraps an unexpected 500 body without fabricating a backend code', async () => {
    mock.onGet('/status').reply(500, '<html>boom</html>');
    const err = await client.get('/status').catch((e) => e);
    expect(err).toBeInstanceOf(GrittyApiError);
    expect(err.code).toBe(CLIENT_ERROR_CODES.Unknown);
    expect(err.status).toBe(500);
  });
});
