// Map of tool slugs to their display names
export const TOOL_DISPLAY_NAMES = {
    execute_command: "run commands",
    read_file: "read files",
    write_to_file: "write files",
    apply_diff: "apply changes",
    search_files: "search files",
    list_files: "list files",
    list_code_definition_names: "list definitions",
    browser_action: "use a browser",
    use_mcp_tool: "use mcp tools",
    access_mcp_resource: "access mcp resources",
    ask_followup_question: "ask questions",
    attempt_completion: "complete tasks",
    switch_mode: "switch modes",
    new_task: "create new task",
    web_search: "search the web",
};
// Define available tool groups
export const TOOL_GROUPS = {
    read: {
        tools: ["read_file", "search_files", "list_files", "list_code_definition_names"],
    },
    edit: {
        tools: ["write_to_file", "apply_diff", "insert_content", "search_and_replace"],
    },
    browser: {
        tools: ["browser_action"],
    },
    command: {
        tools: ["execute_command"],
    },
    mcp: {
        tools: ["use_mcp_tool", "access_mcp_resource"],
    },
    web: {
        tools: ["web_search"],
    },
    modes: {
        tools: ["switch_mode", "new_task"],
        alwaysAvailable: true,
    },
};
// Tools that are always available to all modes
export const ALWAYS_AVAILABLE_TOOLS = [
    "ask_followup_question",
    "attempt_completion",
    "switch_mode",
    "new_task",
];
// Tool helper functions
export function getToolName(toolConfig) {
    return typeof toolConfig === "string" ? toolConfig : toolConfig[0];
}
export function getToolOptions(toolConfig) {
    return typeof toolConfig === "string" ? undefined : toolConfig[1];
}
// Display names for groups in UI
export const GROUP_DISPLAY_NAMES = {
    read: "Read Files",
    edit: "Edit Files",
    browser: "Use Browser",
    command: "Run Commands",
    mcp: "Use MCP",
    web: "Web Search",
};
//# sourceMappingURL=tool-groups.js.map