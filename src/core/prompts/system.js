import { modes, defaultModeSlug, getModeBySlug, } from "../../shared/modes";
import { getToolDescriptionsForMode } from "./tools";
import { getRulesSection, getSystemInfoSection, getObjectiveSection, getSharedToolUseSection, getMcpServersSection, getToolUseGuidelinesSection, getCapabilitiesSection, getModesSection, addCustomInstructions, } from "./sections";
async function generatePrompt(context, cwd, supportsComputerUse, mode, mcpHub, diffStrategy, browserViewportSize, promptComponent, customModeConfigs, globalCustomInstructions, preferredLanguage, diffEnabled, experiments, enableMcpServerCreation) {
    if (!context) {
        throw new Error("Extension context is required for generating system prompt");
    }
    // If diff is disabled, don't pass the diffStrategy
    const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined;
    const [mcpServersSection, modesSection] = await Promise.all([
        getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation),
        getModesSection(context),
    ]);
    // Get the full mode config to ensure we have the role definition
    const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0];
    const roleDefinition = promptComponent?.roleDefinition || modeConfig.roleDefinition;
    const basePrompt = `${roleDefinition}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(mode, cwd, supportsComputerUse, effectiveDiffStrategy, browserViewportSize, mcpHub, customModeConfigs, experiments)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, mcpHub, effectiveDiffStrategy)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, experiments)}

${getSystemInfoSection(cwd, mode, customModeConfigs)}

${getObjectiveSection()}

${await addCustomInstructions(promptComponent?.customInstructions || modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, { preferredLanguage })}`;
    return basePrompt;
}
export const SYSTEM_PROMPT = async (context, cwd, supportsComputerUse, mcpHub, diffStrategy, browserViewportSize, mode = defaultModeSlug, customModePrompts, customModes, globalCustomInstructions, preferredLanguage, diffEnabled, experiments, enableMcpServerCreation) => {
    if (!context) {
        throw new Error("Extension context is required for generating system prompt");
    }
    const getPromptComponent = (value) => {
        if (typeof value === "object" && value !== null) {
            return value;
        }
        return undefined;
    };
    // Check if it's a custom mode
    const promptComponent = getPromptComponent(customModePrompts?.[mode]);
    // Get full mode config from custom modes or fall back to built-in modes
    const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0];
    // If diff is disabled, don't pass the diffStrategy
    const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined;
    return generatePrompt(context, cwd, supportsComputerUse, currentMode.slug, mcpHub, effectiveDiffStrategy, browserViewportSize, promptComponent, customModes, globalCustomInstructions, preferredLanguage, diffEnabled, experiments, enableMcpServerCreation);
};
//# sourceMappingURL=system.js.map