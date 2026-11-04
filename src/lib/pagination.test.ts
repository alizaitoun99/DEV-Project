import { expect, it } from "vitest";
import { getPageNumbers, getPagination, parsePage } from "./pagination";

it("defaults malformed and repeated page values to the first page", () => {
  for (const value of [undefined, "", "0", "-1", "1.5", "2x", "1e3", "999999999999999999999", ["2", "3"]]) {
    expect(parsePage(value)).toBe(1);
  }
  expect(parsePage("3")).toBe(3);
});

it("clamps pages after deletion and handles empty and partial pages", () => {
  expect(getPagination(0, 5, 21)).toEqual({ page: 1, totalPages: 1, skip: 0 });
  expect(getPagination(43, 2, 21)).toEqual({ page: 2, totalPages: 3, skip: 21 });
  expect(getPagination(42, 3, 21)).toEqual({ page: 2, totalPages: 2, skip: 21 });
});

it("keeps large pagination controls bounded with first and last page access", () => {
  expect(getPageNumbers(500, 1000)).toEqual([1, 499, 500, 501, 1000]);
  expect(getPageNumbers(1, 1)).toEqual([1]);
});
