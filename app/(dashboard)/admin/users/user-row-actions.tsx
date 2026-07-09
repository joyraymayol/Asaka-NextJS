"use client";

import { useState } from "react";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { UserFormDialog } from "./user-form-dialog";
import { DeleteUserButton } from "./delete-user-button";
import type { UserDTO } from "@/lib/traccar/dto";

export function UserRowActions({ user }: { user: UserDTO }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <RowActionsMenu
        label={user.name}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <UserFormDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteUserButton id={user.id} name={user.name} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
