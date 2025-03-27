import { isToolAllowedForMode } from "../shared/modes";
export { isToolAllowedForMode };
export function validateToolUse(toolName, mode, customModes, toolRequirements, toolParams) {
    if (!isToolAllowedForMode(toolName, mode, customModes ?? [], toolRequirements, toolParams)) {
        throw new Error(`Tool "${toolName}" is not allowed in ${mode} mode.`);
    }
}
//# sourceMappingURL=mode-validator.js.map