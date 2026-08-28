import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify } from "../src/slugify.js";

const cases = [
  ["Hello World", "hello-world"],
  ["  One / Two!!!  ", "one-two"],
  ["---", ""],
] as const;

test("slugifies strings", () => {
  for (const [value, expected] of cases) {
    assert.equal(slugify(value), expected);
  }
});
