import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthBackground } from "./auth-background";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <AuthBackground />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-2xl font-semibold tracking-tight">Asaka</span>
          <span className="text-xs text-muted-foreground">GPS fleet tracking</span>
        </div>
        <Card className="w-full border border-border/60 bg-card/80 shadow-xl shadow-foreground/5 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your existing Asaka account.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
