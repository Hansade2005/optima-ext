export const EXPERIMENT_IDS = {
    DIFF_STRATEGY: "experimentalDiffStrategy",
    SEARCH_AND_REPLACE: "search_and_replace",
    INSERT_BLOCK: "insert_content",
};
export const experimentConfigsMap = {
    DIFF_STRATEGY: {
        name: "Use experimental unified diff strategy",
        description: "Enable the experimental unified diff strategy. This strategy might reduce the number of retries caused by model errors but may cause unexpected behavior or incorrect edits. Only enable if you understand the risks and are willing to carefully review all changes.",
        enabled: false,
    },
    SEARCH_AND_REPLACE: {
        name: "Use experimental search and replace tool",
        description: "Enable the experimental search and replace tool, allowing Optima to replace multiple instances of a search term in one request.",
        enabled: false,
    },
    INSERT_BLOCK: {
        name: "Use experimental insert content tool",
        description: "Enable the experimental insert content tool, allowing Roo to insert content at specific line numbers without needing to create a diff.",
        enabled: false,
    },
};
export const experimentDefault = Object.fromEntries(Object.entries(experimentConfigsMap).map(([_, config]) => [
    EXPERIMENT_IDS[_],
    config.enabled,
]));
export const experiments = {
    get: (id) => {
        return experimentConfigsMap[id];
    },
    isEnabled: (experimentsConfig, id) => {
        return experimentsConfig[id] ?? experimentDefault[id];
    },
};
// Expose experiment details for UI - pre-compute from map for better performance
export const experimentLabels = Object.fromEntries(Object.entries(experimentConfigsMap).map(([_, config]) => [
    EXPERIMENT_IDS[_],
    config.name,
]));
export const experimentDescriptions = Object.fromEntries(Object.entries(experimentConfigsMap).map(([_, config]) => [
    EXPERIMENT_IDS[_],
    config.description,
]));
//# sourceMappingURL=experiments.js.map