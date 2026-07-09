// Deliberately no administrator gate (unlike app/(dashboard)/admin/layout.tsx
// this route moved out of): every signed-in user may view their own devices
// and manage trips. Traccar filters /api/devices per session, and the
// admin-only CRUD actions in this route stay guarded in the DAL.
export default function DevicesLayout({ children }: { children: React.ReactNode }) {
  return <div className="p-6">{children}</div>;
}
