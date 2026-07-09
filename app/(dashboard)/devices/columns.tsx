"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableSortHeader } from "@/components/data-table-sort-header";
import { DeviceFormDialog } from "./device-form-dialog";
import { DeleteDeviceButton } from "./delete-device-button";
import { TripsDialog } from "./trips-dialog";
import { RouteDialog } from "./route-dialog";
import type { DeviceDTO } from "@/lib/traccar/dto";

const STATUS_VARIANT = {
  online: "default",
  offline: "secondary",
  unknown: "secondary",
} as const;

/** DeviceDTO enriched server-side with its ACTIVE trip count (Prisma groupBy). */
export type DeviceRow = DeviceDTO & { activeTripCount: number };

// Column defs are functions, so they must never cross the Server/Client
// boundary -- the client wrapper (devices-table.tsx) calls this. Admin-only
// columns are also enforced server-side in the DAL; hiding them here is UX,
// not security.
export function getColumns(isAdmin: boolean): ColumnDef<DeviceRow>[] {
  const columns: ColumnDef<DeviceRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableSortHeader column={column}>Name</DataTableSortHeader>,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "uniqueId",
      header: ({ column }) => <DataTableSortHeader column={column}>Unique ID</DataTableSortHeader>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableSortHeader column={column}>Status</DataTableSortHeader>,
      cell: ({ row }) => {
        const device = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            <Badge variant={STATUS_VARIANT[device.status]}>{device.status}</Badge>
            {device.disabled && <Badge variant="destructive">Disabled</Badge>}
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: ({ column }) => <DataTableSortHeader column={column}>Category</DataTableSortHeader>,
      cell: ({ row }) => row.original.category ?? "—",
    },
    {
      accessorKey: "activeTripCount",
      header: ({ column }) => <DataTableSortHeader column={column}>Trips</DataTableSortHeader>,
      cell: ({ row }) => {
        const device = row.original;
        return (
          <div className="flex gap-2">
            <TripsDialog
              deviceId={device.id}
              deviceName={device.name}
              triggerLabel={
                device.activeTripCount > 0 ? `${device.activeTripCount} running` : "Trips"
              }
            />
            <RouteDialog deviceId={device.id} deviceName={device.name} />
          </div>
        );
      },
    },
  ];

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <DeviceFormDialog device={row.original} />
          <DeleteDeviceButton id={row.original.id} name={row.original.name} />
        </div>
      ),
    });
  }

  return columns;
}
