/**
 * Convert complex content blocks to simple string content
 */
export function convertToSimpleContent(content) {
    if (typeof content === "string") {
        const textBlock = {
            type: "text",
            text: content,
            citations: []
        };
        return [textBlock];
    }
    return content.map((block) => {
        if (block.type === "text") {
            const textBlock = {
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
export function convertToSimpleMessages(messages) {
    return messages.map((message) => ({
        role: message.role,
        content: convertFromSimpleContent(convertToSimpleContent(message.content)),
    }));
}
export function convertFromSimpleContent(content) {
    return content
        .map((block) => {
        if (block.type === "text") {
            return block.text;
        }
        return "";
    })
        .join("\n");
}
export function createSimpleMessage(text) {
    const textBlock = {
        type: "text",
        text: text,
        citations: []
    };
    const usage = {
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
//# sourceMappingURL=simple-format.js.map