import { listUsers } from "@/lib/dal/users";
import { UserFormDialog } from "./user-form-dialog";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Users</h1>
        <UserFormDialog />
      </div>
      <UsersTable data={users} />
    </div>
  );
}
