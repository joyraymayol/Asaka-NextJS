"use client";

import { useState } from "react";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { DeviceFormDialog } from "./device-form-dialog";
import { DeleteDeviceButton } from "./delete-device-button";
import type { DeviceDTO } from "@/lib/traccar/dto";

export function DeviceRowActions({ device }: { device: DeviceDTO }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <RowActionsMenu
        label={device.name}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <DeviceFormDialog device={device} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteDeviceButton id={device.id} name={device.name} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
