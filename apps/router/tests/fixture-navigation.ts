import { useSyncExternalStore } from "react";
const listen = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
export function navigate(href: string, replace = false) {
  window.history[replace ? "replaceState" : "pushState"]({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, true),
  refresh: () => window.dispatchEvent(new PopStateEvent("popstate")),
  back: () => window.history.back(),
  prefetch: () => {},
};
export const useRouter = () => router;
export const usePathname = () =>
  useSyncExternalStore(
    listen,
    () => window.location.pathname,
    () => "/dashboard",
  );
export const useSearchParams = () =>
  new URLSearchParams(window.location.search);
export const redirect = (href: string) => navigate(href, true);
