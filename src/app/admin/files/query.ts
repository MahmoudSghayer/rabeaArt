import type { Prisma } from "@/generated/prisma/client";

/**
 * URL-param contract for the files grid — same shape as `admin/customers/query.ts`, kept
 * self-contained per the parallel-workstream file-ownership rules in AGENTS.md.
 *
 * URL params:
 *  - `q`: free-text search against the linked order's `ref` (case-insensitive).
 *  - `page`: 1-based page number (page size: `FILES_PAGE_SIZE`).
 */

export const FILES_PAGE_SIZE = 24;

export type FilesSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedFilesQuery {
  q: string | null;
  page: number;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilesQuery(params: FilesSearchParams): ParsedFilesQuery {
  const q = firstValue(params.q)?.trim() || null;
  const pageRaw = Number(firstValue(params.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { q, page };
}

export function buildFilesWhere(parsed: ParsedFilesQuery): Prisma.OrderFileWhereInput {
  if (!parsed.q) return {};
  return { order: { ref: { contains: parsed.q, mode: "insensitive" } } };
}
