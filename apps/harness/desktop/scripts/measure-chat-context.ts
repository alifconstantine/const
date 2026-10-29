import { CONST_DEFAULT_TOOLS } from "../../../../packages/agent/src/const/tools";
import { nativeCapabilityForTool, nativePluginLoader } from "../../../../packages/agent/src/const/deferred-tools";
import { estimateTextTokens, estimateToolsTokens } from "../../../../packages/agent/src/const/token-meter";
import { INTELLIGENCE_UI_PROMPT } from "../src/components/intelligence-ui/prompt";

const native = CONST_DEFAULT_TOOLS.filter(tool => nativeCapabilityForTool(tool.function.name));
const deferred = [
  ...CONST_DEFAULT_TOOLS.filter(tool => !nativeCapabilityForTool(tool.function.name)),
  nativePluginLoader(["browser-use", "computer-use"]),
];
const wire = (tools: typeof CONST_DEFAULT_TOOLS) => tools.map(({ requiresApproval: _approval, ...definition }) => definition);
const before = estimateToolsTokens(wire(CONST_DEFAULT_TOOLS));
const after = estimateToolsTokens(wire(deferred));
console.log(JSON.stringify({
  measurement: "Local schema sizes and character/4 estimates; not provider billing or latency measurements",
  openUi: { charactersRemovedFromDefaultPrompt: INTELLIGENCE_UI_PROMPT.length, estimatedTokens: estimateTextTokens(INTELLIGENCE_UI_PROMPT) },
  tools: { before: CONST_DEFAULT_TOOLS.length, deferredNative: native.length, after: deferred.length,
    estimatedBefore: before, estimatedAfter: after, estimatedSaved: before - after },
}, null, 2));
