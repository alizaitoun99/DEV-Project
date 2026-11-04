import { z } from "zod";

export const ITEMS_PER_PAGE = 21;
export const COLLECTIONS_PER_PAGE = 21;
export const DASHBOARD_COLLECTIONS_LIMIT = 6;
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;

export interface PaginationSearchParams {
  [key: string]: string | string[] | undefined;
}

export function parsePage(value: string | string[] | undefined): number {
  const result = z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().positive().max(2147483647)).safeParse(value);
  return result.success ? result.data : 1;
}

export function getPagination(total: number, requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return { page, totalPages, skip: (page - 1) * pageSize };
}

export function getPageNumbers(page: number, totalPages: number): number[] {
  return [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b);
}
