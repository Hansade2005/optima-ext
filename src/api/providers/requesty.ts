import { OpenAiHandler, OpenAiHandlerOptions } from "./openai"
import { ModelInfo, requestyModelInfoSaneDefaults, requestyDefaultModelId } from "../../shared/api"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"

export class RequestyHandler extends OpenAiHandler {
	constructor(options: OpenAiHandlerOptions) {
		if (!options.requestyApiKey) {
			throw new Error("Requesty API key is required. Please provide it in the settings.")
		}
		super({
			...options,
			openAiApiKey: options.requestyApiKey,
			openAiModelId: options.requestyModelId ?? requestyDefaultModelId,
			openAiBaseUrl: "https://router.requesty.ai/v1",
			openAiCustomModelInfo: options.requestyModelInfo ?? requestyModelInfoSaneDefaults,
			defaultHeaders: {
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
<<<<<<< HEAD
				"X-Title": "Roo Code",
=======
				"X-Title": "Optima AI",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
			},
		})
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.requestyModelId ?? requestyDefaultModelId
		return {
			id: modelId,
			info: this.options.requestyModelInfo ?? requestyModelInfoSaneDefaults,
		}
	}

	protected override processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.cache_creation_input_tokens,
			cacheReadTokens: usage?.cache_read_input_tokens,
		}
	}
}
