import Link from "next/link";
import { getPageNumbers, type PaginationSearchParams } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  totalPages: number;
  pathname: string;
  searchParams: PaginationSearchParams;
}

export function Pagination({ page, totalPages, pathname, searchParams }: PaginationProps) {
  const numbers = getPageNumbers(page, totalPages);
  function href(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      for (const entry of Array.isArray(value) ? value : [value]) query.append(key, entry);
    }
    query.set("page", String(target));
    return `${pathname}?${query}`;
  }
  const style = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? <Link className={style} href={href(page - 1)} rel="prev">Previous</Link> : <span className={`${style} text-muted-foreground opacity-50`} aria-disabled="true">Previous</span>}
      {numbers.map((number, index) => (
        <span key={number} className="inline-flex items-center gap-2">
          {index > 0 && number - numbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
          <Link className={`${style} ${number === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} href={href(number)} aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined}>{number}</Link>
        </span>
      ))}
      {page < totalPages ? <Link className={style} href={href(page + 1)} rel="next">Next</Link> : <span className={`${style} text-muted-foreground opacity-50`} aria-disabled="true">Next</span>}
    </nav>
  );
}
