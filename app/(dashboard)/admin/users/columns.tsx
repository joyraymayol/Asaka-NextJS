"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableSortHeader } from "@/components/data-table-sort-header";
import { UserFormDialog } from "./user-form-dialog";
import { DeleteUserButton } from "./delete-user-button";
import type { UserDTO } from "@/lib/traccar/dto";

export const columns: ColumnDef<UserDTO>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableSortHeader column={column}>Name</DataTableSortHeader>,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableSortHeader column={column}>Email</DataTableSortHeader>,
  },
  {
    id: "flags",
    accessorFn: (user) => (user.administrator ? 1 : 0),
    header: ({ column }) => <DataTableSortHeader column={column}>Flags</DataTableSortHeader>,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex flex-wrap gap-1">
          {user.administrator && <Badge variant="secondary">Administrator</Badge>}
          {user.readonly && <Badge variant="secondary">Read-only</Badge>}
          {user.deviceReadonly && <Badge variant="secondary">Device read-only</Badge>}
          {user.limitCommands && <Badge variant="secondary">Limit commands</Badge>}
          {user.disabled && <Badge variant="destructive">Disabled</Badge>}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <UserFormDialog user={row.original} />
        <DeleteUserButton id={row.original.id} name={row.original.name} />
      </div>
    ),
  },
];
