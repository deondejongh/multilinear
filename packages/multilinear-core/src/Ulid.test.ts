import { assert, describe, it } from "@effect/vitest";

import { decodeUlidTime, isUlid, makeUlidGenerator, MAX_ULID_TIME, ULID_LENGTH } from "./Ulid.ts";

/** Deterministic RNG: fills with a fixed byte. */
const constantFill =
  (byte: number) =>
  (bytes: Uint8Array): void => {
    bytes.fill(byte);
  };

describe("makeUlidGenerator", () => {
  it("produces 26-char Crockford base32 ids", () => {
    const generator = makeUlidGenerator(constantFill(0xab));
    const id = generator.next(1_700_000_000_000);
    assert.strictEqual(id.length, ULID_LENGTH);
    assert.isTrue(isUlid(id));
  });

  it("round-trips the time component", () => {
    const generator = makeUlidGenerator(constantFill(0));
    const time = 1_719_000_123_456;
    assert.strictEqual(decodeUlidTime(generator.next(time)), time);
  });

  it("is strictly monotonic for same-millisecond calls", () => {
    const generator = makeUlidGenerator(constantFill(0x10));
    const time = 1_700_000_000_000;
    const first = generator.next(time);
    const second = generator.next(time);
    const third = generator.next(time);
    assert.isTrue(second > first);
    assert.isTrue(third > second);
    assert.strictEqual(decodeUlidTime(second), time);
  });

  it("is monotonic when the clock goes backwards", () => {
    const generator = makeUlidGenerator(constantFill(0x10));
    const first = generator.next(2_000_000_000_000);
    const second = generator.next(1_000_000_000_000);
    assert.isTrue(second > first);
    assert.strictEqual(decodeUlidTime(second), 2_000_000_000_000);
  });

  it("carries the random-component increment across byte boundaries", () => {
    const generator = makeUlidGenerator(constantFill(0xff));
    const time = 1_700_000_000_000;
    const first = generator.next(time);
    // All-0xff random overflows into the time component rather than wrapping.
    const second = generator.next(time);
    assert.isTrue(second > first);
    assert.strictEqual(decodeUlidTime(second), time + 1);
  });

  it("clamps times beyond the 48-bit range", () => {
    const generator = makeUlidGenerator(constantFill(0));
    assert.strictEqual(decodeUlidTime(generator.next(Number.MAX_SAFE_INTEGER)), MAX_ULID_TIME);
  });

  it("orders ids lexicographically by time", () => {
    const generator = makeUlidGenerator(constantFill(0x80));
    const older = generator.next(1_000);
    const newer = generator.next(2_000);
    assert.isTrue(newer > older);
  });
});
