/**
 * Web search tool description
 */
export function getWebSearchDescription(): string {
    return `## web_search

Search the web for real-time information and get structured content from web pages.

### Input:
\`\`\`json
{
    "query": "The search query to look up on the web",
    "maxResults": 5, // Optional, defaults to 5
    "useCache": true // Optional, defaults to true
}
\`\`\`

### Example:
\`\`\`json
{
    "query": "latest typescript features",
    "maxResults": 3
}
\`\`\`

### Results:
This tool returns structured data from web search results including:
- Title and URL of each result
- Clean extracted text content
- Links found on the page
- Images found on the page

You should use this tool when:
- You need current information that might not be in your training data
- You need to verify facts or get up-to-date documentation
- The user asks about recent events, technologies, or other time-sensitive information

The search uses Bing and returns the top results, visiting each page to extract useful content.`
} 