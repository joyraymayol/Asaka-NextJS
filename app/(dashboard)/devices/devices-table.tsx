"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/data-table";
import { getColumns, type DeviceRow } from "./columns";

// See users/users-table.tsx for why this indirection exists: page.tsx (a
// Server Component) must only ever pass plain serializable data across the
// boundary, never the column defs themselves.
export function DevicesTable({ data, isAdmin }: { data: DeviceRow[]; isAdmin: boolean }) {
  const columns = useMemo(() => getColumns(isAdmin), [isAdmin]);
  return <DataTable columns={columns} data={data} />;
}
