"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createDeviceAction, updateDeviceAction } from "./actions";
import type { DeviceDTO } from "@/lib/traccar/dto";
import type { DeviceInput } from "@/lib/dal/devices";

type FormState = {
  name: string;
  uniqueId: string;
  category: string;
  disabled: boolean;
};

function toFormState(device?: DeviceDTO): FormState {
  return {
    name: device?.name ?? "",
    uniqueId: device?.uniqueId ?? "",
    category: device?.category ?? "",
    disabled: device?.disabled ?? false,
  };
}

export function DeviceFormDialog({ device }: { device?: DeviceDTO }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(device));
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(device);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(toFormState(device));
      setError(undefined);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    const input: DeviceInput = {
      name: form.name,
      uniqueId: form.uniqueId,
      category: form.category || null,
      disabled: form.disabled,
    };

    startTransition(async () => {
      const result = isEdit ? await updateDeviceAction(device!.id, input) : await createDeviceAction(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? `${form.name} updated` : `${form.name} created`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={isEdit ? "outline" : "default"} size={isEdit ? "sm" : "default"} />}>
        {isEdit ? "Edit" : "Add device"}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${device!.name}` : "Add device"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Changes are applied directly on your Traccar server."
                : "Creates a new device on your Traccar server. The unique ID must match what the device itself reports."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="uniqueId">Unique ID (IMEI)</Label>
              <Input
                id="uniqueId"
                required
                value={form.uniqueId}
                onChange={(e) => setForm((f) => ({ ...f, uniqueId: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="disabled">Disabled</Label>
              <Switch
                id="disabled"
                checked={form.disabled}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, disabled: checked }))}
              />
            </div>

            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
