import { createFileRoute } from "@tanstack/react-router";
import POSPage from "@/pages/POSPage";
import { useEffect, useState } from "react";
import { initializeNativePersistence } from "@/lib/nativePersistence";

export const Route = createFileRoute("/")({
  component: Index,
});

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    initializeNativePersistence().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="font-cairo text-muted-foreground">جاري تحميل النظام...</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Index() {
  return (
    <ClientOnly>
      <POSPage />
    </ClientOnly>
  );
}
