import test from "node:test";
import assert from "node:assert/strict";
import { readAll } from "./read-all";

function pager(total: number) {
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const data: number[] = [];
    for (let i = from; i <= to && i < total; i++) data.push(i);
    return { data, error: null };
  };
  return { page, calls };
}

test("readAll reads past the first page", async () => {
  const { page, calls } = pager(25);
  const { rows, error } = await readAll(page, 10);
  assert.equal(error, null);
  assert.equal(rows.length, 25);
  assert.deepEqual(rows.slice(0, 3), [0, 1, 2]);
  assert.deepEqual(calls, [
    [0, 9],
    [10, 19],
    [20, 29],
  ]);
});

test("readAll handles an exact multiple of the page size", async () => {
  const { page } = pager(20);
  const { rows } = await readAll(page, 10);
  assert.equal(rows.length, 20);
});

test("readAll handles no rows", async () => {
  const { page } = pager(0);
  const { rows, error } = await readAll(page, 10);
  assert.deepEqual(rows, []);
  assert.equal(error, null);
});

test("readAll reports an error and does not hide a partial read", async () => {
  let n = 0;
  const { rows, error } = await readAll<number>(async (from) => {
    if (n++ === 1) return { data: null, error: { message: "boom" } };
    return {
      data: Array.from({ length: 10 }, (_, i) => from + i),
      error: null,
    };
  }, 10);
  assert.equal(error, "boom");
  assert.equal(rows.length, 10);
});
