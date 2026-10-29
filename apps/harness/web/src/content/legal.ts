import type { ArticleSection } from "./docs";

export const operator = {
  name: "Alif Farhanul Hakim",
  brand: "Const",
  address: "JL Asrama Nyantong, Tasikmalaya, Indonesia",
  // Intentionally reserved and non-deliverable. Replace before publishing policy.
  email: "contact@const.example",
  updated: "29 October 2026",
};

export const privacySections: ArticleSection[] = [
  {
    id: "scope",
    title: "Who operates the service",
    paragraphs: [
      `Const is operated by ${operator.name}, using the name ${operator.brand}, at ${operator.address}. This notice describes data handling in Const Harness and its connections to Const Accounts and Const Router. Other products and third-party services may have additional notices.`,
      "This is a draft notice. The contact address below is a placeholder, not an operating support or privacy channel.",
    ],
  },
  {
    id: "data",
    title: "Information used by the product",
    paragraphs: [
      "Local workspace information includes conversations, project references, tool activity, usage details, preferences, and workbench state. Project files remain in the folders you use; the agent may read or change files when your task and permissions allow it.",
      "Connected account information can include your name, email address, profile image, authentication records, and connection credentials. Const Router stores API-key records, model and routing configuration, request usage, errors, quotas, and credit or transaction records where those features are used.",
      "Prompts, conversation context, selected files, attachments, and tool results can be sent to the model or tool you connect. Router can retain a truncated prompt when payload logging is enabled. Router settings also control whether its request records include IP addresses and user agents.",
    ],
  },
  {
    id: "purpose",
    title: "Why information is processed",
    paragraphs: [
      "Information is used to authenticate accounts, provide requested model and tool actions, maintain conversations, deliver remote sessions, measure usage, apply quotas and charges, troubleshoot failures, and protect service access.",
      "Depending on the activity and applicable law, processing may be necessary to provide the service you request, comply with legal obligations, protect service security, or act on your consent. Optional connections are initiated by you; permissions and consent can be withdrawn through the relevant product or provider controls.",
    ],
  },
  {
    id: "sharing",
    title: "Connected services and recipients",
    paragraphs: [
      "Selected model providers receive the context sent for inference. MCP servers, plugins, websites, and desktop applications receive information involved in their tool actions. Their own terms govern their processing, retention, and use of that data.",
      "Const uses Convex for connected backend and authentication functions, Google for supported sign-in and OAuth flows, and Resend for email sign-in delivery. Website hosting and network providers may process technical request information. Provider connections and hosting can involve processing outside Indonesia; applicable safeguards and transfer requirements must be addressed for the actual deployment.",
      "Information may also be disclosed when required by applicable law or necessary to investigate abuse and protect the service. Do not connect sensitive material until you understand the recipients and have authority to share it.",
    ],
  },
  {
    id: "remote",
    title: "Remote control",
    paragraphs: [
      "Paired clients encrypt remote command and response payloads before relay through the backend. The relay still processes session identifiers, device information, expiry, delivery metadata, and encrypted packets. The host computer executes the requested work.",
      "Keep pairing links private and stop a session when access should end. Relay encryption does not extend to every model request, tool integration, or file stored on your device.",
    ],
  },
  {
    id: "storage",
    title: "Browser storage and retention",
    paragraphs: [
      "Browser storage is used for settings such as language and theme, authentication state, and remote connection state where applicable. Connected providers and hosting may use their own storage or security mechanisms.",
      "Local records remain until removed through available app controls or the filesystem, and may also exist in your backups. Cloud account, usage, and transaction records are retained as needed to provide the service, resolve disputes, protect security, and meet applicable legal obligations. This draft does not establish a fixed cloud retention period; the operator must finalize a retention schedule before publication.",
      "Remote sessions and packets have expiry and cleanup mechanisms. Ending a session does not itself delete unrelated account records, provider logs, or local project files.",
    ],
  },
  {
    id: "choices",
    title: "Your choices and requests",
    paragraphs: [
      "You can manage local conversations, disconnect integrations, revoke provider credentials, stop remote sessions, and adjust Router logging settings through the relevant controls. Removing one kind of data does not automatically remove copies held by another service.",
      "Subject to applicable law, you may request information about processing, access, correction, a copy, deletion, restriction or cessation of processing, and withdrawal of consent. Requests may require identity verification and can be subject to legal retention duties or other permitted limits. You may raise a complaint through the applicable supervisory or legal channels.",
      "A monitored contact channel must replace the placeholder below before this notice is used as a published policy. Do not send identity documents or private account details to the placeholder.",
    ],
  },
  {
    id: "security",
    title: "Security, children, and changes",
    paragraphs: [
      "Protect your device, keys, and connected sessions. No storage or transmission method is risk-free. Security incidents and any required notices must be handled under applicable law.",
      "Const Harness is a general workbench, not a service designed specifically for children. Anyone unable to consent or enter the applicable terms independently must involve a parent or legal guardian as required by law.",
      "This notice should be updated when the service or its data practices change. Material changes should be communicated through the relevant service alongside a revised date.",
    ],
  },
];

export const termsSections: ArticleSection[] = [
  {
    id: "agreement",
    title: "The service and these terms",
    paragraphs: [
      `Const Harness is operated by ${operator.name}, using the name Const, at ${operator.address}. These draft terms cover the Harness desktop workbench, its website, and its remote-control features. Const Accounts, Router, connected providers, and third-party packages may apply additional terms.`,
      "These terms remain a draft while the operator finalizes its monitored contact channel and operating policies. Mandatory consumer and data-protection rights are not excluded by this document.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and access",
    paragraphs: [
      "Use accurate account information, keep credentials and pairing links secure, and use only accounts and systems you are authorized to access. You are responsible for choosing the project folders, model connections, and tool access you give the agent.",
      "You must have legal capacity to use the service or obtain the authorization of a parent or guardian where required. Do not share access in a way that exposes another person’s data or exceeds their permission.",
    ],
  },
  {
    id: "agents",
    title: "Agent actions and your review",
    paragraphs: [
      "Harness can read and change files, execute commands, interact with websites and desktop applications, and use connected services according to the available tools and permissions. More permissive settings can allow actions without individual confirmations.",
      "Review outputs, code changes, sources, and external actions before relying on them. AI output may be inaccurate, incomplete, or unsuitable for your purpose. Keep backups and apply appropriate professional judgment, particularly for consequential decisions.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "Use the service lawfully and respect the rights of others. Do not use it for unauthorized access, malware, fraud, harassment, unlawful surveillance, infringement, or attempts to compromise service security.",
      "Do not bypass quotas, abuse credentials, disrupt shared infrastructure, or submit material you lack authority to process. Automated work must follow the rules and permissions of the systems it interacts with.",
    ],
  },
  {
    id: "content",
    title: "Your content and connected services",
    paragraphs: [
      "You retain the rights you hold in your inputs and files. You authorize the processing necessary to perform your requested tasks and provide the connected features you use. These terms do not guarantee exclusive rights in generated output or that output is free of third-party rights.",
      "Model providers, plugins, MCP servers, websites, and other connected services remain subject to their own licenses, terms, permissions, and privacy practices. Review them before connecting. Open-source components remain governed by their applicable licenses.",
    ],
  },
  {
    id: "fees",
    title: "Usage and charges",
    paragraphs: [
      "Model and tool requests may consume provider credits, paid usage, or a service quota. Bring-your-own-key connections may be billed directly by the provider. Const Router shows the usage and credit information applicable to its service.",
      "Check the terms and charges displayed by the relevant service before using paid features. This page does not promise permanent free access, a fixed allowance, or a refund policy. Any paid offer must disclose its price and applicable payment, cancellation, and refund terms before purchase.",
    ],
  },
  {
    id: "availability",
    title: "Availability and ending use",
    paragraphs: [
      "Features depend on the build, operating system, provider availability, and configured tools. Remote and scheduled tasks need a running, connected desktop. The service does not guarantee uninterrupted availability or successful completion of every task.",
      "You can stop using the app, stop remote sessions, and revoke connected access. Access may be restricted where reasonably necessary to address abuse, security risks, or legal obligations, with notice where practical and required. Account-data requests are described in the Privacy Policy.",
    ],
    link: { label: "Read the Privacy Policy", href: "/privacy-policy" },
  },
  {
    id: "responsibility",
    title: "Responsibility and applicable law",
    paragraphs: [
      "The service is provided on an available basis to the extent permitted by applicable law. You remain responsible for the tasks you authorize and how you use their results. Nothing in these terms excludes liability or rights that cannot lawfully be excluded.",
      "These terms are intended to be governed by Indonesian law, subject to mandatory protections that apply to you. Raise service disputes with the operator first once a monitored contact is available. If a dispute is unresolved, the available competent legal forum and applicable consumer protections remain available.",
    ],
  },
  {
    id: "changes",
    title: "Changes and contact",
    paragraphs: [
      "When the service or these terms change, the operator should publish an updated version and date and provide notice of material changes where required. Review the terms that apply before continuing to use a changed feature.",
      "The contact email below is a placeholder and is not monitored. The operator must replace it before publishing these terms as final.",
    ],
  },
];
