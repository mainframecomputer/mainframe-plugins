import { type OpenClawPluginApi, registerMainframeHooks } from "./runtime.js";

// OpenClaw loads this default export and calls `register(api)` once. We model
// the plugin entry shape locally rather than importing the openclaw SDK just
// for its `definePluginEntry` identity helper, keeping this package free of a
// host dependency like the other hosts.
export type OpenClawPluginEntry = {
  id: string;
  name: string;
  description: string;
  register: (api: OpenClawPluginApi) => void;
};

const plugin: OpenClawPluginEntry = {
  id: "mainframe",
  name: "Mainframe",
  description: "Create and share short video updates from agent work.",
  register(api: OpenClawPluginApi): void {
    registerMainframeHooks(api);
  },
};

export default plugin;
export { registerMainframeHooks };
