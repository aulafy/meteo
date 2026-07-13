import { json } from './_lib.js';

export default function handler() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  return publicKey ? json({ publicKey }) : json({ error: 'Push remoto no configurado' }, 503);
}
