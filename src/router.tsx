import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createHashHistory } from "@tanstack/history";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Under Electron/Capacitor the app loads from file:// (or capacitor://).
  // The pathname is a filesystem path that won't match any route, so we
  // fall back to hash-based routing which is safe under any protocol.
  const isFileProtocol =
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" ||
      window.location.protocol === "app:" ||
      window.location.protocol === "capacitor:" ||
      window.location.protocol === "ionic:");

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(isFileProtocol ? { history: createHashHistory() } : {}),
  });

  return router;
};
