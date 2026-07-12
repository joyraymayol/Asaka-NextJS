"use client";

import { useEffect, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const SEARCH_DEBOUNCE_MS = 500;

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** When set, renders a search box that filters across all columns. */
  searchPlaceholder?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // `search` tracks the input on every keystroke; `globalFilter` (what the
  // table actually filters on) trails it by SEARCH_DEBOUNCE_MS so we don't
  // filter mid-typing.
  const [search, setSearch] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setGlobalFilter(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const tableElement = (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-muted-foreground text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  if (!searchPlaceholder) return tableElement;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>
      {tableElement}
    </div>
  );
}
