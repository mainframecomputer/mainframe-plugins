import { registerMainframeHooks } from "./runtime.js";
const plugin = {
    id: "mainframe",
    name: "Mainframe",
    description: "Create and share short video updates from agent work.",
    register(api) {
        registerMainframeHooks(api);
    },
};
export default plugin;
export { registerMainframeHooks };
