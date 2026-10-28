import type { Metadata } from "next";
import { RemoteWorkspace } from "@/components/remote/remote-workspace";
import { DEFAULT_CONVEX_URL } from "@const/remote/config";

export const metadata: Metadata = {
  title: "Const Harness — Remote",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function RemotePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <RemoteWorkspace
      sessionId={sessionId}
      convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL || DEFAULT_CONVEX_URL}
    />
  );
}
