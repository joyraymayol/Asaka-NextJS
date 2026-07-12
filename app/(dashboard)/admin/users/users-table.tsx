"use client";

import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import type { UserDTO } from "@/lib/traccar/dto";

// Client-to-client only: page.tsx (a Server Component) passes plain
// serializable data here, never the column defs themselves -- `columns`
// contains render functions that must not cross the server->client prop
// boundary as a prop value (that hits "Functions cannot be passed directly
// to Client Components" at runtime, even though `next build` won't catch it
// for a dynamic route). Importing columns.tsx directly in this already-client
// module sidesteps the question entirely.
export function UsersTable({ data }: { data: UserDTO[] }) {
  return <DataTable columns={columns} data={data} searchPlaceholder="Search users..." />;
}
