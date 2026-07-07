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
import { createUserAction, updateUserAction } from "./actions";
import type { UserDTO } from "@/lib/traccar/dto";
import type { UserInput } from "@/lib/dal/users";

type FormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  administrator: boolean;
  readonly: boolean;
  deviceReadonly: boolean;
  limitCommands: boolean;
  disabled: boolean;
};

function toFormState(user?: UserDTO): FormState {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    administrator: user?.administrator ?? false,
    readonly: user?.readonly ?? false,
    deviceReadonly: user?.deviceReadonly ?? false,
    limitCommands: user?.limitCommands ?? false,
    disabled: user?.disabled ?? false,
  };
}

export function UserFormDialog({ user }: { user?: UserDTO }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(user));
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(user);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(toFormState(user));
      setError(undefined);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    const input: UserInput = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      administrator: form.administrator,
      readonly: form.readonly,
      deviceReadonly: form.deviceReadonly,
      limitCommands: form.limitCommands,
      disabled: form.disabled,
      ...(form.password ? { password: form.password } : {}),
    };

    startTransition(async () => {
      const result = isEdit ? await updateUserAction(user!.id, input) : await createUserAction(input);
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
        {isEdit ? "Edit" : "Add user"}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${user!.name}` : "Add user"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Changes are applied directly on your Traccar server." : "Creates a new user on your Traccar server."}
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{isEdit ? "New password (leave blank to keep current)" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                required={!isEdit}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            {(
              [
                ["administrator", "Administrator"],
                ["readonly", "Read-only"],
                ["deviceReadonly", "Device read-only"],
                ["limitCommands", "Limit commands"],
                ["disabled", "Disabled"],
              ] as const
            ).map(([key, labelText]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key}>{labelText}</Label>
                <Switch
                  id={key}
                  checked={form[key]}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked }))}
                />
              </div>
            ))}

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
