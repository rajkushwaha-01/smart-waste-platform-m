import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requestPrediction,
  AiTimeoutError,
  AiNetworkError,
  AiRequestError,
  AiServerError,
  AiMalformedResponseError,
} from '../../src/modules/ai/ai.client.js';
import { config } from '../../src/config/index.js';

const payload = { binId: 'BIN-001', fillLevel: 82 };

function axiosErrorWithResponse(status, data = {}) {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, data };
  return err;
}

function axiosNetworkError() {
  const err = new Error('connect ECONNREFUSED');
  err.request = {};
  return err;
}

function axiosTimeoutError() {
  const err = new Error('timeout of 5000ms exceeded');
  err.code = 'ECONNABORTED';
  return err;
}

describe('requestPrediction', () => {
  let httpClient;

  beforeEach(() => {
    httpClient = { post: vi.fn() };
  });

  it('posts to the configured predict path and returns the validated response', async () => {
    const responseBody = { predictedFillLevel: 90, overflowRiskScore: 0.8 };
    httpClient.post.mockResolvedValue({ data: responseBody });

    const result = await requestPrediction(payload, { httpClient });

    expect(httpClient.post).toHaveBeenCalledWith(config.aiService.predictPath, payload);
    expect(result).toEqual(responseBody);
  });

  it('throws AiTimeoutError on a timeout, after retrying up to the configured limit', async () => {
    httpClient.post.mockRejectedValue(axiosTimeoutError());

    await expect(requestPrediction(payload, { httpClient })).rejects.toBeInstanceOf(AiTimeoutError);
    expect(httpClient.post).toHaveBeenCalledTimes(config.aiService.maxRetries + 1);
  });

  it('throws AiRequestError on a 4xx response without retrying', async () => {
    httpClient.post.mockRejectedValue(axiosErrorWithResponse(422, { message: 'bad payload' }));

    await expect(requestPrediction(payload, { httpClient })).rejects.toBeInstanceOf(AiRequestError);
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('throws AiServerError on a 5xx response, retrying up to the configured limit', async () => {
    httpClient.post.mockRejectedValue(axiosErrorWithResponse(503));

    await expect(requestPrediction(payload, { httpClient })).rejects.toBeInstanceOf(AiServerError);
    expect(httpClient.post).toHaveBeenCalledTimes(config.aiService.maxRetries + 1);
  });

  it('recovers on a later attempt after transient 5xx failures', async () => {
    const responseBody = { predictedFillLevel: 50, overflowRiskScore: 0.1 };
    httpClient.post
      .mockRejectedValueOnce(axiosErrorWithResponse(503))
      .mockResolvedValueOnce({ data: responseBody });

    const result = await requestPrediction(payload, { httpClient });

    expect(result).toEqual(responseBody);
    expect(httpClient.post).toHaveBeenCalledTimes(2);
  });

  it('throws AiNetworkError when the request never reaches the server', async () => {
    httpClient.post.mockRejectedValue(axiosNetworkError());

    await expect(requestPrediction(payload, { httpClient })).rejects.toBeInstanceOf(AiNetworkError);
    expect(httpClient.post).toHaveBeenCalledTimes(config.aiService.maxRetries + 1);
  });

  it('throws AiMalformedResponseError for a 2xx response with an unexpected shape, without retrying', async () => {
    httpClient.post.mockResolvedValue({ data: { unexpected: true } });

    await expect(requestPrediction(payload, { httpClient })).rejects.toBeInstanceOf(
      AiMalformedResponseError,
    );
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('throws AiMalformedResponseError for a null/non-object response body', async () => {
    httpClient.post.mockResolvedValue({ data: null });

    await expect(requestPrediction(payload, { httpClient })).rejects.toBeInstanceOf(
      AiMalformedResponseError,
    );
  });
});
