import {
  buildJsonPluginConfigSchema,
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

import { registerMainframeHooks } from "./runtime.js";

export default definePluginEntry({
  id: "mainframe",
  name: "Mainframe",
  description: "Create and share short Mainframe video updates from coding-agent work.",
  configSchema: buildJsonPluginConfigSchema({
    type: "object",
    additionalProperties: false,
  }),
  register(api: OpenClawPluginApi) {
    registerMainframeHooks(api);
  },
});

export { registerMainframeHooks };
