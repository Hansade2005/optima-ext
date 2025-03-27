<<<<<<< HEAD
import { Anthropic } from "@anthropic-ai/sdk"
=======
import { Anthropic, } from "@anthropic-ai/sdk"

/**
 * Represents a block of text content with optional citations.
 */
type TextBlock = {
	type: "text";
	text: string;
	citations: Anthropic.TextCitationParam[];
};
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

/**
 * Convert complex content blocks to simple string content
 */
<<<<<<< HEAD
export function convertToSimpleContent(
	content:
		| string
		| Array<
				| Anthropic.Messages.TextBlockParam
				| Anthropic.Messages.ImageBlockParam
				| Anthropic.Messages.ToolUseBlockParam
				| Anthropic.Messages.ToolResultBlockParam
		  >,
): string {
	if (typeof content === "string") {
		return content
	}

	// Extract text from content blocks
	return content
		.map((block) => {
			if (block.type === "text") {
				return block.text
			}
			if (block.type === "image") {
				return `[Image: ${block.source.media_type}]`
			}
			if (block.type === "tool_use") {
				return `[Tool Use: ${block.name}]`
			}
			if (block.type === "tool_result") {
				if (typeof block.content === "string") {
					return block.content
				}
				if (Array.isArray(block.content)) {
					return block.content
						.map((part) => {
							if (part.type === "text") {
								return part.text
							}
							if (part.type === "image") {
								return `[Image: ${part.source.media_type}]`
							}
							return ""
						})
						.join("\n")
				}
				return ""
			}
			return ""
		})
		.filter(Boolean)
		.join("\n")
=======
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
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
}

/**
 * Convert Anthropic messages to simple format with string content
 */
export function convertToSimpleMessages(
	messages: Anthropic.Messages.MessageParam[],
): Array<{ role: "user" | "assistant"; content: string }> {
	return messages.map((message) => ({
		role: message.role,
<<<<<<< HEAD
		content: convertToSimpleContent(message.content),
	}))
}
=======
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
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
