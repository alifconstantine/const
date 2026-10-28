"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RemoteClient } from "@const/remote/client";
import type {
  RemoteBootstrap,
  RemoteConversation,
  RemotePacket,
} from "@const/remote/protocol";
import { remoteAuth } from "./auth";
import { emptyLive, reduceLive } from "@const/remote/live";

export function useRemote(sessionId: string, url: string) {
  const client = useRef<RemoteClient | null>(null);
  const selectedRef = useRef("");
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<
    "connecting" | "login" | "missingKey" | "error" | "ready"
  >("connecting");
  const [online, setOnline] = useState(false);
  const [device, setDevice] = useState("");
  const [profile, setProfile] = useState<{
    name?: string;
    email?: string;
  } | null>(null);
  const [bootstrap, setBootstrap] = useState<RemoteBootstrap | null>(null);
  const [selected, setSelected] = useState("");
  const [conversation, setConversation] = useState<
    (RemoteConversation & { live?: any }) | null
  >(null);
  const [live, setLive] = useState<any>({
    text: "",
    tools: [],
    status: "idle",
  });
  const [sending, setSending] = useState(false);
  const [failedSend, setFailedSend] = useState(false);
  const [runError, setRunError] = useState(false);
  const [draft, setDraft] = useState("");
  const [project, setProject] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef(0);
  const snapshotVersion = useRef(0);
  const loadingSnapshot = useRef(false);
  const queuedEvents = useRef<RemotePacket[]>([]);
  const applyStream = useCallback((packet: RemotePacket) => {
    if (loadingSnapshot.current) {
      queuedEvents.current.push(packet);
      return;
    }
    setLive((previous: any) =>
      reduceLive(
        { ...emptyLive(), ...previous },
        packet.event,
        packet.sequence as number | undefined,
      ),
    );
  }, []);

  const request = useCallback(async (type: any, payload?: any) => {
    if (!client.current) throw new Error("REMOTE_DISCONNECTED");
    const response = await client.current.request({
      type,
      ...(payload ? { payload } : {}),
    });
    if (response?.success === false)
      throw new Error(response.error || "REMOTE_FAILED");
    return response;
  }, []);
  const refresh = useCallback(async () => {
    const data = (await request("state:get")) as RemoteBootstrap;
    setBootstrap(data);
    setModel((previous) => previous || data.models[0]?.id || "");
  }, [request]);
  const select = useCallback(
    async (id: string) => {
      const version = ++snapshotVersion.current;
      queuedEvents.current = [];
      loadingSnapshot.current = !!id;
      selectedRef.current = id;
      setSelected(id);
      setConversation(null);
      setLive({ text: "", tools: [], status: "idle" });
      setFailedSend(false);
      setRunError(false);
      sessionStorage.setItem(`const_remote_selected:${sessionId}`, id);
      if (!id) {
        setLoading(false);
        setProject("");
        return;
      }
      setLoading(true);
      try {
        const result = await request("conversation:get", {
          conversationId: id,
        });
        if (selectedRef.current !== id || snapshotVersion.current !== version)
          return;
        setConversation(result.conversation);
        setModel((previous) => result.conversation?.model || previous);
        setLive(
          result.conversation?.live || {
            text: "",
            tools: [],
            status: result.conversation?.isRunning ? "running" : "idle",
          },
        );
        loadingSnapshot.current = false;
        for (const packet of queuedEvents.current) applyStream(packet);
        queuedEvents.current = [];
      } finally {
        if (snapshotVersion.current === version) {
          setLoading(false);
          loadingSnapshot.current = false;
        }
      }
    },
    [request, sessionId, applyStream],
  );

  useEffect(() => {
    const generation = ++active.current;
    setConnection("connecting");
    setProfile(null);
    setOnline(false);
    selectedRef.current = "";
    setSelected("");
    setConversation(null);
    setLive(emptyLive());
    let peer: RemoteClient | null = null;
    if (!url) {
      setConnection("error");
      return;
    }
    let credentials: ReturnType<typeof remoteAuth>;
    try {
      credentials = remoteAuth(sessionId);
    } catch {
      setConnection("error");
      return;
    }
    if (!credentials.key) {
      setConnection("missingKey");
      return;
    }
    if (!credentials.token) {
      setConnection("login");
      return;
    }
    const events = (packet: RemotePacket) => {
      if (active.current !== generation) return;
      if (packet.type === "resync") {
        void refresh()
          .then(async () => {
            if (selectedRef.current) await select(selectedRef.current);
          })
          .catch(() => setConnection("error"));
      }
      if (
        packet.type === "conversation:changed" ||
        packet.type === "agent:session-ended"
      ) {
        void refresh().catch(() => {});
        if (packet.conversationId === selectedRef.current)
          void select(selectedRef.current).catch(() => setConnection("error"));
      }
      if (packet.conversationId !== selectedRef.current) return;
      if (
        packet.type === "conversation:changed" &&
        packet.success === false &&
        !packet.aborted
      ) {
        setRunError(true);
      }
      if (packet.type === "agent:session-started") {
        setConversation((current) =>
          current
            ? { ...current, isRunning: true, runId: packet.runId }
            : current,
        );
        setLive({ text: "", tools: [], status: "running" });
      }
      if (packet.type === "agent:stream-event") applyStream(packet);
    };
    peer = new RemoteClient(
      sessionId,
      credentials.key,
      url,
      credentials.token,
      events,
      (isOnline, name) => {
        if (active.current !== generation) return;
        setOnline(isOnline);
        setDevice(name);
      },
      () => {
        if (active.current === generation) {
          setOnline(false);
          setConnection("error");
        }
      },
    );
    client.current = peer;
    void peer
      .connect()
      .then(async () => {
        if (active.current !== generation) return;
        void peer
          ?.profile()
          .then((profile) => {
            if (active.current === generation) setProfile(profile);
          })
          .catch(() => {});
        await refresh();
        if (active.current !== generation) return;
        setConnection("ready");
        const id = sessionStorage.getItem(`const_remote_selected:${sessionId}`);
        if (id) await select(id);
      })
      .catch(() => {
        if (active.current === generation) setConnection("error");
      });
    return () => {
      active.current++;
      client.current = null;
      void peer?.close();
    };
  }, [sessionId, url, attempt, refresh, select, applyStream]);

  const send = async () => {
    if (!draft.trim() || sending || !online || failedSend) return;
    const text = draft.trim();
    const id = selectedRef.current || `remote_${crypto.randomUUID()}`;
    sessionStorage.setItem(`const_remote_draft:${sessionId}:${id}`, text);
    selectedRef.current = id;
    setSelected(id);
    sessionStorage.setItem(`const_remote_selected:${sessionId}`, id);
    setSending(true);
    try {
      await request("conversation:send", {
        conversationId: id,
        text,
        model: model || undefined,
        project: project || undefined,
      });
      setDraft("");
      sessionStorage.removeItem(`const_remote_draft:${sessionId}:${id}`);
      sessionStorage.removeItem(`const_remote_draft:${sessionId}:new`);
      await select(id);
      await refresh();
    } catch {
      setFailedSend(true);
    } finally {
      setSending(false);
    }
  };
  useEffect(() => {
    setDraft(
      sessionStorage.getItem(
        `const_remote_draft:${sessionId}:${selected || "new"}`,
      ) || "",
    );
  }, [sessionId, selected]);
  const updateDraft = (text: string) => {
    setDraft(text);
    sessionStorage.setItem(
      `const_remote_draft:${sessionId}:${selectedRef.current || "new"}`,
      text,
    );
  };
  const disconnect = async () => {
    await client.current?.close(true);
    client.current = null;
    setOnline(false);
    setConnection("missingKey");
  };
  return {
    connection,
    online,
    device,
    profile,
    bootstrap,
    selected,
    conversation,
    live,
    sending,
    failedSend,
    runError,
    draft,
    project,
    model,
    loading,
    request,
    refresh,
    select,
    send,
    setDraft: updateDraft,
    setProject,
    setModel,
    setLive,
    reconnect: () => setAttempt((value) => value + 1),
    disconnect,
  };
}
