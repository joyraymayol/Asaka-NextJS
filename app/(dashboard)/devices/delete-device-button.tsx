"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteDeviceAction } from "./actions";

export function DeleteDeviceButton({
  id,
  name,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  id: number;
  name: string;
  /** Controlled mode -- see DeviceFormDialog for the same pattern/rationale. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;
  const [isPending, startTransition] = useTransition();

  // Two-step confirmation, per user request ("just to be double sure"): the
  // first dialog's button doesn't delete anything -- it just closes itself,
  // and once fully closed (onOpenChangeComplete, same reasoning as
  // components/row-actions-menu.tsx: opening a second overlay mid-close-
  // animation fights the first one's teardown) opens a second, final
  // confirmation that's the only place the actual delete action fires.
  const [confirmPending, setConfirmPending] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDeviceAction(id);
      if (result.error) {
        toast.error(result.error);
        return; // keep the final dialog open so they can see the error and retry
      }
      toast.success(`${name} deleted`);
      setFinalOpen(false);
    });
  }

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(isOpen) => {
          if (isOpen || !confirmPending) return;
          setConfirmPending(false);
          setFinalOpen(true);
        }}
      >
        {!isControlled && (
          <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Delete</AlertDialogTrigger>
        )}
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the device on your Traccar server, including its history. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPending(true);
                setOpen(false);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={finalOpen} onOpenChange={setFinalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This is the last check -- confirming immediately and permanently deletes <strong>{name}</strong>{" "}
              from your Traccar server. There is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : `Yes, delete ${name}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
