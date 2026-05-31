/**
 * Word-aware sliding window chunking algorithm
 * Splits raw content into chunks of roughly `maxChars` size with `overlap` chars.
 */
function chunkText(text, maxChars = 600, overlap = 120) {
  if (!text || text.trim().length === 0) return [];

  // Standardize whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // If the text is smaller than our target chunk size, return it as a single chunk
  if (cleanText.length <= maxChars) {
    return [{
      text: cleanText,
      charCount: cleanText.length,
      wordCount: cleanText.split(' ').length
    }];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + maxChars;

    // If we reach the end of the text, cap it
    if (endIndex >= cleanText.length) {
      endIndex = cleanText.length;
    } else {
      // Find the nearest space to avoid cutting a word in half
      const lastSpace = cleanText.lastIndexOf(' ', endIndex);
      if (lastSpace > startIndex) {
        endIndex = lastSpace;
      }
    }

    const chunkContent = cleanText.substring(startIndex, endIndex).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        text: chunkContent,
        charCount: chunkContent.length,
        wordCount: chunkContent.split(' ').length
      });
    }

    // Stop if we reached the end of the string
    if (endIndex >= cleanText.length) {
      break;
    }

    // Move startIndex forward by subtracting overlap
    startIndex = endIndex - overlap;

    // Safeguard to prevent infinite loops in case overlap is configured incorrectly
    if (startIndex <= 0 || startIndex >= endIndex) {
      startIndex = endIndex;
    } else {
      // Move startIndex to the next word boundary
      const nextSpace = cleanText.indexOf(' ', startIndex);
      if (nextSpace > 0 && nextSpace < endIndex) {
        startIndex = nextSpace + 1;
      }
    }
  }

  return chunks;
}

module.exports = { chunkText };
