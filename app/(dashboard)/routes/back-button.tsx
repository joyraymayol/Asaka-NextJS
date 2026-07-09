"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Plain browser history back, not a hardcoded destination -- this route is
// reached from both the devices table and the map popup, and "Back to
// devices" was wrong/confusing when arriving from the map.
export function BackButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()}>
      <ArrowLeft />
      Back
    </Button>
  );
}
