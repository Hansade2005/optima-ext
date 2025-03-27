export function checkExistKey(config) {
    return config
        ? [
            config.apiKey,
            config.glamaApiKey,
            config.openRouterApiKey,
            config.awsRegion,
            config.vertexProjectId,
            config.openAiApiKey,
            config.ollamaModelId,
            config.lmStudioModelId,
            config.geminiApiKey,
            config.openAiNativeApiKey,
            config.deepSeekApiKey,
            config.mistralApiKey,
            config.vsCodeLmModelSelector,
            config.requestyApiKey,
            config.unboundApiKey,
        ].some((key) => key !== undefined)
        : false;
}
//# sourceMappingURL=checkExistApiConfig.js.map