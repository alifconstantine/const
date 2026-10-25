import { getDesktopBuilds } from "@/lib/releases";
import { DownloadPage } from "@/components/DownloadPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ arch?: string; os?: string }>;
}) {
  const [result, query] = await Promise.all([getDesktopBuilds(), searchParams]);
  return (
    <DownloadPage
      builds={result.builds}
      available={result.available}
      arch={query.arch}
      os={query.os}
    />
  );
}
