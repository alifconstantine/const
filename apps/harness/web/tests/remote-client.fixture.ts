const conversations: any[] = [
  {
    id: "remote_history",
    title: "Review background task logs",
    project: "Outside Project",
    model: "test-model",
    messages: [
      { role: "user", content: "Show me the latest task status." },
      {
        role: "assistant",
        content: "The task has completed. All background workers have stopped.",
      },
    ],
    contextUsage: { usedTokens: 12640, totalTokens: 128000 },
    telemetry: { totalTokens: 18420 },
  },
];
export class RemoteClient {
  private timers: ReturnType<typeof setTimeout>[] = [];
  constructor(
    _id: string,
    _key: string,
    _url: string,
    _token: string,
    private event: (event: any) => void,
    private presence: (online: boolean, device: string) => void,
  ) {}
  async connect() {
    this.presence(true, "desktop-studio");
  }
  async profile() {
    return { name: "Const developer", email: "developer@example.invalid" };
  }
  async request(command: any): Promise<any> {
    if (command.type === "state:get")
      return {
        deviceId: "desktop-studio",
        conversations: conversations.map((c) => ({
          ...c,
          messages: undefined,
        })),
        projects: ["D:/Projects/Const"],
        models: [{ id: "test-model", displayName: "Test model" }],
        runningSessions: [],
      };
    if (command.type === "conversation:get")
      return {
        conversation:
          conversations.find(
            (conversation) =>
              conversation.id === command.payload.conversationId,
          ) || null,
      };
    if (command.type === "conversation:send") {
      let conversation = conversations.find(
        (c) => c.id === command.payload.conversationId,
      );
      if (!conversation) {
        conversation = {
          id: command.payload.conversationId,
          title: command.payload.text.slice(0, 60),
          project: "Outside Project",
          messages: [],
        };
        conversations.unshift(conversation);
      }
      conversation.messages.push({
        role: "user",
        content: command.payload.text,
      });
      conversation.isRunning = true;
      conversation.runId = "fixture-run";
      this.timers.push(
        setTimeout(() => {
          this.event({
            type: "agent:stream-event",
            conversationId: conversation.id,
            runId: conversation.runId,
            event: {
              type: "token",
              token:
                "The connection is ready. This response verifies the mobile chat flow.",
            },
          });
        }, 150),
      );
      this.timers.push(
        setTimeout(() => {
          conversation.isRunning = false;
          conversation.messages.push({
            role: "assistant",
            content:
              "The connection is ready. This response verifies the mobile chat flow.",
          });
          this.event({
            type: "agent:session-ended",
            conversationId: conversation.id,
          });
        }, 500),
      );
      return { success: true, runId: conversation.runId };
    }
    if (command.type === "conversation:rename") {
      const conversation = conversations.find(
        (c) => c.id === command.payload.conversationId,
      );
      if (conversation) conversation.title = command.payload.title;
      return { success: true };
    }
    if (command.type === "conversation:archive") {
      const index = conversations.findIndex(
        (c) => c.id === command.payload.conversationId,
      );
      if (index >= 0) conversations.splice(index, 1);
      return { success: true };
    }
    if (command.type === "scheduled:list")
      return {
        tasks: [
          {
            id: "scheduled-1",
            name: "Daily workspace review",
            nextRunAt: "2026-10-28T02:00:00Z",
          },
        ],
      };
    if (command.type === "marketplace:list")
      return {
        plugins: [
          {
            id: "browser",
            name: "Browser",
            description: "Read and interact with websites on your desktop.",
          },
        ],
      };
    return { success: true };
  }
  async close() {
    this.timers.forEach(clearTimeout);
  }
}
