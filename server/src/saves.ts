import { isObject } from './http.js';

/** The game's save document: `S` in src/game.js. The server stores it whole and reads only these fields. */
export interface SaveDoc {
  v: 1;
  savedAt: number;
  pet: { name: string; xp?: number };
  littles: unknown[];
  [key: string]: unknown;
}

export const SAVE_MAX_BYTES = 256 * 1024;

/** Why a save cannot be stored, as a sentence, or null when it is fine. */
export function saveProblem(value: unknown): string | null {
  if (!isObject(value)) return 'it is not a Glimmerkin save.';
  if (value.v !== 1) return 'it is from a version of the game this server does not know.';
  if (!isObject(value.pet) || typeof value.pet.name !== 'string' || !value.pet.name || value.pet.name.length > 40) return 'it has no creature in it.';
  if (!Array.isArray(value.littles) || value.littles.length > 500) return 'its littles are missing.';
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || value.savedAt < 0) return 'it does not say when it was saved.';
  if (value.savedAt > Date.now() + 86_400_000) return 'it says it was saved in the future. Check the clock on the device it came from.';
  if (Buffer.byteLength(JSON.stringify(value)) > SAVE_MAX_BYTES) return 'it is larger than 256 KB.';
  return null;
}
