import { requestPrediction } from './ai.client.js';

export {
  AiClientError,
  AiTimeoutError,
  AiNetworkError,
  AiRequestError,
  AiServerError,
  AiMalformedResponseError,
} from './ai.client.js';

/**
 * ASSUMED CONTRACT — the real AI API request/response shape was not
 * provided (the API contract details were left as placeholders).
 * These two mapping functions are the ONLY place that shape is
 * assumed; everything else in the app deals only with
 * predictBinTelemetry()'s domain-shaped input/output below. Once the
 * real contract is confirmed, update these two functions (and
 * AI_SERVICE_PREDICT_PATH / AI_SERVICE_API_KEY in .env) — no other
 * module needs to change.
 */
function toAiRequest(event) {
  return {
    binId: event.binId,
    fillLevel: event.fillLevel,
    battery: event.battery,
    temperature: event.temperature,
    latitude: event.latitude,
    longitude: event.longitude,
    timestamp: event.timestamp,
  };
}

function toDomainPrediction(raw) {
  return {
    predictedFillLevel: raw.predictedFillLevel,
    overflowProbability: raw.overflowProbability,
    overflowEtaHours: raw.overflowEtaHours ?? null,
    confidence: raw.confidence ?? null,
  };
}

/**
 * Internal entry point the rest of the app should call for a
 * telemetry-based prediction. Takes/returns the app's own domain
 * shapes; the external AI API's request/response format is fully
 * isolated inside this module and ai.client.js.
 *
 * Throws an AiClientError (see ai.client.js) on failure — callers
 * (the telemetry consumer) decide how to degrade when that happens.
 */
export async function predictBinTelemetry(event) {
  const requestPayload = toAiRequest(event);
  const raw = await requestPrediction(requestPayload);
  return toDomainPrediction(raw);
}
