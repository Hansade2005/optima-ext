import OpenAI, { AzureOpenAI } from "openai";
import { azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults, } from "../../shared/api";
import { convertToOpenAiMessages } from "../transform/openai-format";
import { convertToR1Format } from "../transform/r1-format";
import { convertToSimpleMessages } from "../transform/simple-format";
export const DEEP_SEEK_DEFAULT_TEMPERATURE = 0.6;
const OPENAI_DEFAULT_TEMPERATURE = 0;
export class OpenAiHandler {
    options;
    client;
    constructor(options) {
        this.options = options;
        const baseURL = this.options.openAiBaseUrl ?? "https://api.openai.com/v1";
        const apiKey = this.options.openAiApiKey ?? "not-provided";
        let urlHost;
        try {
            urlHost = new URL(this.options.openAiBaseUrl ?? "").host;
        }
        catch (error) {
            // Likely an invalid `openAiBaseUrl`; we're still working on
            // proper settings validation.
            urlHost = "";
        }
        if (urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure) {
            // Azure API shape slightly differs from the core API shape:
            // https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
            this.client = new AzureOpenAI({
                baseURL,
                apiKey,
                apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
            });
        }
        else {
            this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: this.options.defaultHeaders });
        }
    }
    async *createMessage(systemPrompt, messages) {
        const modelInfo = this.getModel().info;
        const modelUrl = this.options.openAiBaseUrl ?? "";
        const modelId = this.options.openAiModelId ?? "";
        const deepseekReasoner = modelId.includes("deepseek-reasoner");
        const ark = modelUrl.includes(".volces.com");
        if (this.options.openAiStreamingEnabled ?? true) {
            const systemMessage = {
                role: "system",
                content: systemPrompt,
            };
            let convertedMessages;
            if (deepseekReasoner) {
                convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages]);
            }
            else if (ark) {
                convertedMessages = [systemMessage, ...convertToSimpleMessages(messages)];
            }
            else {
                convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)];
            }
            const requestOptions = {
                model: modelId,
                temperature: this.options.modelTemperature ??
                    (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : OPENAI_DEFAULT_TEMPERATURE),
                messages: convertedMessages,
                stream: true,
                stream_options: { include_usage: true },
            };
            if (this.options.includeMaxTokens) {
                requestOptions.max_tokens = modelInfo.maxTokens;
            }
            const stream = await this.client.chat.completions.create(requestOptions);
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta ?? {};
                if (delta.content) {
                    yield {
                        type: "text",
                        text: delta.content,
                    };
                }
                if ("reasoning_content" in delta && delta.reasoning_content) {
                    yield {
                        type: "reasoning",
                        text: delta.reasoning_content || "",
                    };
                }
                if (chunk.usage) {
                    yield this.processUsageMetrics(chunk.usage);
                }
            }
        }
        else {
            // o1 for instance doesnt support streaming, non-1 temp, or system prompt
            const systemMessage = {
                role: "user",
                content: systemPrompt,
            };
            const requestOptions = {
                model: modelId,
                messages: deepseekReasoner
                    ? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
                    : [systemMessage, ...convertToOpenAiMessages(messages)],
            };
            const response = await this.client.chat.completions.create(requestOptions);
            yield {
                type: "text",
                text: response.choices[0]?.message.content || "",
            };
            yield this.processUsageMetrics(response.usage);
        }
    }
    processUsageMetrics(usage) {
        return {
            type: "usage",
            inputTokens: usage?.prompt_tokens || 0,
            outputTokens: usage?.completion_tokens || 0,
        };
    }
    getModel() {
        return {
            id: this.options.openAiModelId ?? "",
            info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
        };
    }
    async completePrompt(prompt) {
        try {
            const requestOptions = {
                model: this.getModel().id,
                messages: [{ role: "user", content: prompt }],
            };
            const response = await this.client.chat.completions.create(requestOptions);
            return response.choices[0]?.message.content || "";
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`OpenAI completion error: ${error.message}`);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=openai.js.map