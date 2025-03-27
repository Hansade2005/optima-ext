/**
 * Copies the given text to clipboard
 * @param text The text to copy
 * @returns A promise that resolves when the text is copied
 */
export default async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.error('Failed to copy using Clipboard API:', error);
      // Fall back to the document.execCommand method
    }
  }

  // Fallback for browsers that don't support the Clipboard API
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      throw new Error('Failed to copy text');
    }
  } catch (error) {
    console.error('Failed to copy using fallback method:', error);
    throw new Error('Could not copy text to clipboard');
  }
} 