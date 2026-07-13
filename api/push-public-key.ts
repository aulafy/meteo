import { type ApiRequest, type ApiResponse, json } from './_lib.js';

export default function handler(_request: ApiRequest, response: ApiResponse) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  return publicKey ? json(response, { publicKey }) : json(response, { error: 'Push remoto no configurado' }, 503);
}
