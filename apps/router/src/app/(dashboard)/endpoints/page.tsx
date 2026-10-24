"use client";
import { useState } from "react";
import Link from "next/link";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { Button, Input, Badge, toast } from "@const/ui";
export default function EndpointsPage() {
  const [search, setSearch] = useState("");
  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      toast.success("Endpoint copied");
    } catch {
      toast.error("Could not access clipboard");
    }
  }
  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-12">
      <header>
        <h1 className="text-3xl font-medium tracking-tight">Endpoints</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Available APIs on Const Router. All execution endpoints require an
          active key or session.
        </p>
      </header>
      <Input
        aria-label="Search endpoints"
        className="rounded-xl"
        placeholder="Search available endpoints"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="space-y-3">
        {ROUTER_ENDPOINTS.filter((e) =>
          (e.name + e.path).toLowerCase().includes(search.toLowerCase()),
        ).map((endpoint) => (
          <div
            key={endpoint.path}
            className="bg-card rounded-2xl p-5 flex flex-wrap justify-between gap-4 items-center"
          >
            <div className="space-y-2">
              <h2 className="font-medium">{endpoint.name}</h2>
              <p className="text-xs text-muted-foreground max-w-xl">
                {endpoint.description}
              </p>
              <p className="text-xs font-mono flex gap-3 items-center">
                <Badge variant="secondary">{endpoint.method}</Badge>
                {endpoint.path}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(endpoint.path)}
            >
              Copy URL
            </Button>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Responses, Anthropic Messages, embeddings, TTS, image, music, and video
        generation are not currently available through this Router.
      </p>
      <Button asChild variant="outline">
        <Link href="/docs">Read API documentation</Link>
      </Button>
    </div>
  );
}
