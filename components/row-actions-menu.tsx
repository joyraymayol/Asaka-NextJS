"use client";

import { useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Shared "..." row-actions trigger for admin tables (devices, users): opens
// a menu with Edit/Delete, each of which opens a separate controlled dialog
// owned by the caller. Deliberately does NOT nest a DialogTrigger inside a
// DropdownMenuItem -- selecting a menu item starts the menu's own closing
// animation/focus teardown, and opening another portal-based overlay (the
// Dialog) in the middle of that fights it. Instead we record which action
// was chosen and only actually open its dialog in onOpenChangeComplete,
// once the menu has *fully* finished closing.
export function RowActionsMenu({
  label,
  onEdit,
  onDelete,
}: {
  /** Used only for the trigger's accessible name, e.g. "Actions for Canter 5". */
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<"edit" | "delete" | null>(null);

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      onOpenChangeComplete={(open) => {
        if (open || !pending) return;
        if (pending === "edit") onEdit();
        else onDelete();
        setPending(null);
      }}
    >
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`} />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Base UI's Menu.Item fires onClick, not onSelect (that's a
            Radix-ism) -- onSelect is technically a valid native DOM prop on
            a div (the textarea/input text-selection event), so this type-
            checks fine either way but silently never fires if you get it
            wrong. */}
        <DropdownMenuItem onClick={() => setPending("edit")}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => setPending("delete")}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
