export interface ArticleSection {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  code?: string;
  link?: { label: string; href: string };
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  sections: ArticleSection[];
}

// Product instructions are checked against the desktop UI, not roadmap notes.
export const guides: Guide[] = [
  {
    slug: "getting-started",
    title: "Your first task",
    description: "Go from a fresh install to a result you can inspect.",
    sections: [
      {
        id: "install",
        title: "Install the desktop app",
        paragraphs: [
          "Open Downloads and choose a published build for your operating system and processor. The workbench is built for Windows, macOS, and Linux. Availability depends on the assets published with each release; an absent build is not a download link.",
          "Web and mobile access connect to a running desktop through remote control. They do not run the local agent independently.",
        ],
        link: { label: "Choose a download", href: "/download" },
      },
      {
        id: "connect",
        title: "Choose how to connect a model",
        paragraphs: [
          "Open Harness and sign in through Const Accounts, then open Settings → Models. Configure a provider and select a model for reasoning. You can use Const Router or a supported provider with your own credentials. Speech, image, and video models have separate settings and may need separate provider access.",
          "A Const account is used by connected Const services, including the authenticated remote relay. Provider charges and Router quotas depend on the service you choose.",
        ],
        link: { label: "Model connections explained", href: "/docs/models" },
      },
      {
        id: "task",
        title: "Give the agent a small, clear task",
        paragraphs: [
          "Choose a project folder and start a conversation. Say what outcome you need, which files matter, and how to verify the result.",
        ],
        steps: [
          "Try: ‘Explain how this project starts. Read the relevant files and give me the command to run it.’",
          "Inspect the agent’s tool activity and any permission requests.",
          "For an editing task, review the diff and run the relevant checks before using the result.",
        ],
      },
      {
        id: "next",
        title: "Build up your workspace",
        paragraphs: [
          "Add tools only as your work needs them. Connect an MCP server, install a skill, or use the built-in browser to inspect a page. Keep a backup or Git history for projects the agent can change.",
        ],
        link: { label: "Work with projects and files", href: "/docs/projects" },
      },
    ],
  },
  {
    slug: "models",
    title: "Models & providers",
    description: "Choose where requests go and which model does the work.",
    sections: [
      {
        id: "providers",
        title: "Connect a provider",
        paragraphs: [
          "In Settings → Models, select a provider preset or configure a custom endpoint using a supported protocol. Add the required credentials, load or configure its models, and select your active reasoning model.",
          "The workbench separates reasoning, speech, image, and video configurations. A provider that supports chat does not necessarily support every media feature.",
        ],
      },
      {
        id: "router",
        title: "Use Const Router",
        paragraphs: [
          "Const Router provides an OpenAI-compatible API alongside model selection, API keys, quotas, request logs, and model combos. Create a Router API key in its dashboard and use the Router connection in Harness.",
          "The base URL is https://router.const.web.id/v1. Use the current Router catalog and dashboard for availability and usage information; this guide does not promise a fixed allowance or price.",
        ],
        link: {
          label: "Read the Router API docs",
          href: "https://router.const.web.id/docs",
        },
      },
      {
        id: "credentials",
        title: "Understand the connection",
        paragraphs: [
          "The selected provider receives the prompt, conversation context, attachments, and tool results included in a request. Local project storage does not make remote inference offline.",
          "Treat API keys as secrets. Avoid putting them in prompts, screenshots, shared repositories, or exported conversations. Review each provider’s privacy and billing terms.",
        ],
      },
      {
        id: "troubleshoot",
        title: "If a model does not respond",
        paragraphs: [
          "Check the endpoint URL, protocol, credentials, model identifier, and provider balance or quota. Test the connection in model settings where available. For rate limits, wait or choose another available model; changing a display name does not change provider access.",
        ],
      },
    ],
  },
  {
    slug: "projects",
    title: "Projects & review",
    description:
      "Keep the conversation, working files, and verification together.",
    sections: [
      {
        id: "context",
        title: "Start with the right folder",
        paragraphs: [
          "Choose the project directory you want the agent to work in. Describe the task and point to useful files or folders. Project instructions and reusable skills help the agent understand conventions without pasting the entire repository into a prompt.",
          "For a large codebase, ask for a map of relevant entry points first, then focused reads. This keeps the context smaller and makes findings easier to check.",
        ],
      },
      {
        id: "permissions",
        title: "Choose permissions deliberately",
        paragraphs: [
          "Use the permission controls available in the conversation before giving the agent access to files, commands, browser sessions, or desktop actions. More permissive modes can allow actions without a separate prompt.",
          "Only connect folders and services you are authorized to use. A permission setting is not a backup or a guarantee that an agent will make the right change.",
        ],
      },
      {
        id: "review",
        title: "Review the work as it happens",
        paragraphs: [
          "Use the workbench’s file, diff, terminal, and browser panes to inspect output beside the conversation. Ask the agent to run the checks that demonstrate the requested behavior.",
          "For code, inspect the diff and test output. For research, inspect the sources. For creative files, open the exported artifact. Agent output can be incomplete or incorrect even when a task finishes.",
        ],
      },
      {
        id: "parallel",
        title: "Use subagents for independent work",
        paragraphs: [
          "The agent runtime supports delegated tasks and execution tracing. Independent investigation or review can run in parallel; edits to the same files still need coordination.",
          "Keep the requested result and acceptance checks explicit. Delegating more work can increase model usage and does not replace your final review.",
        ],
      },
    ],
  },
  {
    slug: "tools",
    title: "Plugins, skills & MCP",
    description: "Add the tools and repeatable workflows a task needs.",
    sections: [
      {
        id: "difference",
        title: "Three ways to extend a task",
        paragraphs: [
          "Skills provide reusable instructions and supporting resources. MCP servers expose tools and resources through the Model Context Protocol. Plugins package capabilities such as skills and MCP connections for installation in the workbench.",
          "Availability and setup depend on the package or service. Installing instructions alone does not grant access to a third-party account.",
        ],
      },
      {
        id: "connect",
        title: "Connect only what you need",
        paragraphs: [
          "Use the Plugins interface to inspect available packages. Use Settings → MCP servers to configure a server and its connection details. Some integrations require credentials, an OAuth sign-in, or a separately installed local program.",
          "Read the package instructions, requested access, and provider terms before connecting it. A tool can expose local files or perform actions on an external service.",
        ],
        link: { label: "Explore integrations", href: "/integrations" },
      },
      {
        id: "browser",
        title: "Browser and computer use",
        paragraphs: [
          "The built-in browser gives the agent a way to navigate, inspect pages, and verify a website. Native computer-use capabilities depend on the operating system, installed helpers, and permissions configured in Settings → Computer use.",
          "Connected browser sessions and desktop screenshots may contain private information. Review the task scope before allowing an agent to interact with signed-in services.",
        ],
      },
      {
        id: "control",
        title: "Keep external actions reviewable",
        paragraphs: [
          "Ask the agent to prepare a concrete result before sending, publishing, or changing external data. Check the destination and content. Disconnect services and remove packages you no longer use through their settings; revoke third-party access with the provider when needed.",
        ],
      },
    ],
  },
  {
    slug: "remote-control",
    title: "Remote control",
    description: "Continue a desktop task from a browser or phone.",
    sections: [
      {
        id: "host",
        title: "Keep the desktop online",
        paragraphs: [
          "Remote control connects to the desktop workbench that runs the task. Keep that computer awake, connected to the network, and running Harness. A browser or phone is a controller; it does not replace the host.",
        ],
      },
      {
        id: "pair",
        title: "Pair a device",
        paragraphs: [
          "Open Remote control in the desktop workbench. Sign in with your Const account if prompted, then explicitly start a session.",
        ],
        steps: [
          "Use the pairing link or scan the QR code shown by the desktop.",
          "Open it on the device you want to connect and complete the pairing flow.",
          "Inspect the connection status before steering a task or reviewing its files.",
        ],
      },
      {
        id: "protect",
        title: "Protect the pairing link",
        paragraphs: [
          "The pairing link contains the information needed to join the session. Share it only with a device and person you trust. Do not paste it into a public issue, screenshot, or chat.",
          "Remote payloads are encrypted between the paired clients. The relay still handles session and device metadata, encrypted packets, and connection timing. Model providers and connected tools have their own data flows.",
        ],
      },
      {
        id: "disconnect",
        title: "End access when you finish",
        paragraphs: [
          "Use the remote controls to disconnect a device or stop the host session. Sessions expire, and refreshing a session produces new pairing information. If a link is exposed, stop the session and create a new one.",
          "If the host is offline or asleep, return to the desktop and check its status. Installing an Android or iOS app is not required for browser-based remote access.",
        ],
      },
    ],
  },
  {
    slug: "scheduled-tasks",
    title: "Scheduled tasks",
    description: "Repeat useful work on the computer that owns the project.",
    sections: [
      {
        id: "create",
        title: "Define a recurring task",
        paragraphs: [
          "Open Scheduled tasks in the workbench. Add a task with a clear prompt, project context, model, and the schedule offered by the form. Describe the output you expect, including where it should be saved and what a successful run should check.",
          "Start with a small task such as a recurring repository check or a research summary. Avoid giving an unattended run broader access than it needs.",
        ],
      },
      {
        id: "runtime",
        title: "Leave Harness running",
        paragraphs: [
          "Scheduled work executes on your computer while the desktop app is running. It depends on the machine being awake, network access, configured models, and available tools. It is not a hosted always-on job service.",
          "Check the selected time and timezone in the form. Do not depend on an unattended task for an urgent action without checking its run history.",
        ],
      },
      {
        id: "history",
        title: "Inspect each result",
        paragraphs: [
          "Review run history and the resulting conversation. A completed run still needs the same source, file, and test checks as an interactive task. Provider errors, quotas, and disconnected tools can interrupt a run.",
        ],
      },
      {
        id: "manage",
        title: "Pause or revise the task",
        paragraphs: [
          "Use the task’s controls to pause, edit, or remove it when the work changes. Recheck the prompt, project folder, model, and permissions after changing a connection or moving a project. Recurring model and tool usage can incur charges.",
        ],
      },
    ],
  },
  {
    slug: "privacy-and-data",
    title: "Privacy & your data",
    description:
      "Understand what stays on your device and what a connected feature sends.",
    sections: [
      {
        id: "local",
        title: "Local workspace storage",
        paragraphs: [
          "The desktop stores conversation history and workbench state locally. Project files remain in the directories you work in. Browser storage also holds preferences and connection configuration. Protect access to your device and keep backups of important work.",
          "Clearing website data, deleting a local conversation, revoking a provider connection, and requesting deletion of cloud account records are separate actions.",
        ],
      },
      {
        id: "requests",
        title: "Models and tools receive context",
        paragraphs: [
          "A request to a model can include your prompt, conversation history, attachments, excerpts from project files, and tool results. MCP services, browser actions, and computer-use workflows can send additional data to the services involved.",
          "Direct provider connections follow that provider’s rules. Requests through Const Router also produce usage and operational records. Router payload logging is configurable and can save a truncated prompt when enabled; telemetry settings also affect IP and user-agent storage.",
        ],
      },
      {
        id: "remote",
        title: "Remote access uses a relay",
        paragraphs: [
          "Paired remote clients exchange encrypted commands and responses through the Const backend. The backend also stores session, device, expiry, and delivery metadata. Encryption for the relay does not make unrelated model requests or local databases end-to-end encrypted.",
        ],
      },
      {
        id: "rights",
        title: "Manage data in each place",
        paragraphs: [
          "Remove local records in the app where controls are available and protect your filesystem backups. Revoke API keys and OAuth connections at their providers. Account-related access, correction, and deletion requests are covered by the Privacy Policy.",
          "The current policy is a draft while a monitored contact address is being established. Do not send private information to the placeholder email.",
        ],
        link: { label: "Read the Privacy Policy", href: "/privacy-policy" },
      },
    ],
  },
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
