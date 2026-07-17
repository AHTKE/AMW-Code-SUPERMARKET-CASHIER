import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import POSPage from "@/pages/POSPage";
import { initializeNativePersistence } from "@/lib/nativePersistence";
import "./styles.css";

// Desktop/Android/iOS use a standalone static SPA shell.  The old working
// desktop build booted the POS page directly instead of hydrating TanStack
// Start's SSR router; keeping that pattern prevents packaged builds from
// showing a non-interactive first screen when router/server state is absent.
const queryClient = new QueryClient();

const rootEl = document.getElementById("root") ?? (() => {
  const el = document.createElement("div");
  el.id = "root";
  document.body.appendChild(el);
  return el;
})();

initializeNativePersistence().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <POSPage />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
