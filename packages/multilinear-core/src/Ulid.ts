/**
 * Zero-dependency monotonic ULID generation.
 *
 * IDs are generated caller-side (01-ARCHITECTURE §3 — multiplayer insurance),
 * so this module must run in both Node and the browser: time and randomness
 * are injected, never read from globals.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;
const RANDOM_BYTES = 10;

export const ULID_LENGTH = TIME_LENGTH + RANDOM_LENGTH;
export const MAX_ULID_TIME = 2 ** 48 - 1;

const ULID_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

export const isUlid = (value: string): boolean => ULID_PATTERN.test(value);

const encodeTime = (timeMs: number): string => {
  let remaining = timeMs;
  let out = "";
  for (let i = 0; i < TIME_LENGTH; i++) {
    out = ALPHABET[remaining % 32] + out;
    remaining = Math.floor(remaining / 32);
  }
  return out;
};

const encodeRandom = (bytes: Uint8Array): string => {
  // 10 bytes = 80 bits = 16 base32 chars. Encode via a bit buffer.
  let out = "";
  let buffer = 0;
  let bitsInBuffer = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      out += ALPHABET[(buffer >>> (bitsInBuffer - 5)) & 31];
      bitsInBuffer -= 5;
    }
  }
  return out;
};

export const decodeUlidTime = (ulid: string): number => {
  let time = 0;
  for (let i = 0; i < TIME_LENGTH; i++) {
    time = time * 32 + ALPHABET.indexOf(ulid[i] ?? "");
  }
  return time;
};

export type RandomFill = (bytes: Uint8Array) => void;

export interface UlidGenerator {
  /**
   * Generate the next ULID at (or after) the given wall-clock time. Strictly
   * monotonic within a generator instance: same-millisecond calls increment
   * the random component; a backwards clock is clamped to the last used time.
   */
  readonly next: (timeMs: number) => string;
}

export const makeUlidGenerator = (randomFill: RandomFill): UlidGenerator => {
  let lastTime = -1;
  const lastRandom = new Uint8Array(RANDOM_BYTES);

  const increment = () => {
    for (let i = RANDOM_BYTES - 1; i >= 0; i--) {
      const value = lastRandom[i] ?? 0;
      if (value < 0xff) {
        lastRandom[i] = value + 1;
        return;
      }
      lastRandom[i] = 0;
    }
    // 80-bit overflow within one millisecond is unreachable in practice;
    // bump the time component to preserve monotonicity anyway.
    lastTime += 1;
  };

  return {
    next: (timeMs) => {
      const clamped = Math.min(Math.max(0, Math.trunc(timeMs)), MAX_ULID_TIME);
      if (clamped <= lastTime) {
        increment();
      } else {
        lastTime = clamped;
        randomFill(lastRandom);
      }
      return encodeTime(lastTime) + encodeRandom(lastRandom);
    },
  };
};
