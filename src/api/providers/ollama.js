import OpenAI from "openai";
import { openAiModelInfoSaneDefaults } from "../../shared/api";
import { convertToOpenAiMessages } from "../transform/openai-format";
import { convertToR1Format } from "../transform/r1-format";
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "./openai";
const OLLAMA_DEFAULT_TEMPERATURE = 0;
export class OllamaHandler {
    options;
    client;
    constructor(options) {
        this.options = options;
        this.client = new OpenAI({
            baseURL: (this.options.ollamaBaseUrl || "http://localhost:11434") + "/v1",
            apiKey: "ollama",
        });
    }
    async *createMessage(systemPrompt, messages) {
        const modelId = this.getModel().id;
        const useR1Format = modelId.toLowerCase().includes("deepseek-r1");
        const openAiMessages = [
            { role: "system", content: systemPrompt },
            ...(useR1Format ? convertToR1Format(messages) : convertToOpenAiMessages(messages)),
        ];
        const stream = await this.client.chat.completions.create({
            model: this.getModel().id,
            messages: openAiMessages,
            temperature: this.options.modelTemperature ?? OLLAMA_DEFAULT_TEMPERATURE,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                yield {
                    type: "text",
                    text: delta.content,
                };
            }
        }
    }
    getModel() {
        return {
            id: this.options.ollamaModelId || "",
            info: openAiModelInfoSaneDefaults,
        };
    }
    async completePrompt(prompt) {
        try {
            const modelId = this.getModel().id;
            const useR1Format = modelId.toLowerCase().includes("deepseek-r1");
            const response = await this.client.chat.completions.create({
                model: this.getModel().id,
                messages: useR1Format
                    ? convertToR1Format([{ role: "user", content: prompt }])
                    : [{ role: "user", content: prompt }],
                temperature: this.options.modelTemperature ??
                    (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : OLLAMA_DEFAULT_TEMPERATURE),
                stream: false,
            });
            return response.choices[0]?.message.content || "";
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Ollama completion error: ${error.message}`);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=ollama.js.map