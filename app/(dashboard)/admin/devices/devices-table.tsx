"use client";

import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import type { DeviceDTO } from "@/lib/traccar/dto";

// See users/users-table.tsx for why this indirection exists: page.tsx (a
// Server Component) must only ever pass plain serializable data across the
// boundary, never the column defs themselves.
export function DevicesTable({ data }: { data: DeviceDTO[] }) {
  return <DataTable columns={columns} data={data} />;
}
