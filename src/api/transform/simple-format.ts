import { Anthropic, } from "@anthropic-ai/sdk"

/**
 * Represents a block of text content with optional citations.
 */
type TextBlock = {
	type: "text";
	text: string;
	citations: Anthropic.TextCitationParam[];
};

/**
 * Convert complex content blocks to simple string content
 */
export function convertToSimpleContent(content: string | Anthropic.ContentBlockParam[]): Anthropic.ContentBlockParam[] {
	if (typeof content === "string") {
		const textBlock: TextBlock = {
			type: "text",
			text: content,
			citations: [] as Anthropic.TextCitationParam[]
		};
		return [textBlock];
	}

	return content.map((block) => {
		if (block.type === "text") {
			const textBlock: TextBlock = {
				type: "text",
				text: block.text,
				citations: []
			};
			return textBlock;
		}
		return block;
	});
}

/**
 * Convert Anthropic messages to simple format with string content
 */
export function convertToSimpleMessages(
	messages: Anthropic.Messages.MessageParam[],
): Array<{ role: "user" | "assistant"; content: string }> {
	return messages.map((message) => ({
		role: message.role,
		content: convertFromSimpleContent(convertToSimpleContent(message.content)),
	}))
}

export function convertFromSimpleContent(content: Anthropic.ContentBlockParam[]): string {
	return content
		.map((block) => {
			if (block.type === "text") {
				return block.text;
			}
			return "";
		})
		.join("\n");
}

export function createSimpleMessage(text: string): Anthropic.Message {
	const textBlock: TextBlock = {
		type: "text",
		text: text,
		citations: []
	};

	type Usage = {
		input_tokens: number;
		output_tokens: number;
		cache_creation_input_tokens: number;
		cache_read_input_tokens: number;
	};

	const usage: Usage = {
		input_tokens: 0,
		output_tokens: 0,
		cache_creation_input_tokens: 0,
		cache_read_input_tokens: 0
	};

	return {
		id: "simple-message",
		type: "message",
		role: "assistant",
		content: [textBlock],
		usage: usage,
		model: "simple",
		stop_reason: null,
		stop_sequence: null
	};
}
