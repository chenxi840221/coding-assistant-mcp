// src/utils/length-control.ts

import { ChatMessage } from '../models/interfaces';

/**
 * Estimate the number of tokens in a text
 * This is a simple approximation - Claude uses BPE tokenization
 * which would require a proper tokenizer
 */
export function estimateTokens(text: string): number {
  // A simple approximation: 1 token ~= 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a token limit
 */
export function truncateText(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Simple approach: truncate based on character ratio
  const ratio = maxTokens / estimatedTokens;
  const newLength = Math.floor(text.length * ratio);
  
  // Try to truncate at a natural boundary like paragraph
  const truncatedText = text.substring(0, newLength);
  
  // Add a note that text was truncated
  return truncatedText + "\n\n[... Content truncated due to length limits]";
}

/**
 * Ensure a conversation fits within context limits
 */
export function truncateConversation(
  messages: ChatMessage[], 
  maxTokens: number
): ChatMessage[] {
  // Always keep the system message
  const systemMessage = messages.find(msg => msg.role === 'system');
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
  
  // Calculate current token usage
  let totalTokens = 0;
  if (systemMessage) {
    totalTokens += estimateTokens(systemMessage.content);
  }
  
  // Keep most recent messages within limit
  const keptMessages: ChatMessage[] = [];
  
  // Process from newest to oldest
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const message = nonSystemMessages[i];
    const messageTokens = estimateTokens(message.content);
    
    // Check if adding this message would exceed the limit
    if (totalTokens + messageTokens > maxTokens) {
      // If this is the most recent user message, try to truncate it
      if (i === nonSystemMessages.length - 1 && message.role === 'user') {
        const remainingTokens = maxTokens - totalTokens;
        const truncatedContent = truncateText(message.content, remainingTokens);
        keptMessages.unshift({
          role: message.role,
          content: truncatedContent
        });
      }
      
      // We've reached the limit, stop adding messages
      break;
    }
    
    // Add this message and update token count
    keptMessages.unshift(message);
    totalTokens += messageTokens;
  }
  
  // Combine system message with kept messages
  return systemMessage ? [systemMessage, ...keptMessages] : keptMessages;
}

/**
 * Format context content to fit within length limits
 */
export function formatContextWithLimit(
  currentFile: string,
  currentCode: string, 
  selection: string,
  relevantFiles: Map<string, string>,
  maxTokens: number
): string {
  let context = '';
  let tokenCount = 0;
  
  // Add current file info
  if (currentFile && currentCode) {
    const fileSection = `## Current File: ${currentFile}\n\n\`\`\`\n${currentCode}\n\`\`\`\n\n`;
    const sectionTokens = estimateTokens(fileSection);
    
    if (tokenCount + sectionTokens <= maxTokens) {
      context += fileSection;
      tokenCount += sectionTokens;
    } else {
      // Truncate the current file content
      const truncatedCode = truncateText(currentCode, maxTokens - estimateTokens(`## Current File: ${currentFile}\n\n\`\`\`\n\n\`\`\`\n\n`));
      context += `## Current File: ${currentFile}\n\n\`\`\`\n${truncatedCode}\n\`\`\`\n\n`;
      return context; // Stop here if we're already at the limit
    }
  }
  
  // Add selection if any
  if (selection) {
    const selectionSection = `## Selected Code\n\n\`\`\`\n${selection}\n\`\`\`\n\n`;
    const sectionTokens = estimateTokens(selectionSection);
    
    if (tokenCount + sectionTokens <= maxTokens) {
      context += selectionSection;
      tokenCount += sectionTokens;
    }
  }
  
  // Add relevant files
  if (relevantFiles.size > 0) {
    context += "## Related Files\n\n";
    tokenCount += estimateTokens("## Related Files\n\n");
    
    for (const [file, content] of relevantFiles.entries()) {
      const fileSection = `### ${file}\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
      const sectionTokens = estimateTokens(fileSection);
      
      if (tokenCount + sectionTokens <= maxTokens) {
        context += fileSection;
        tokenCount += sectionTokens;
      } else {
        // Try to add a truncated version
        const headerTokens = estimateTokens(`### ${file}\n\n\`\`\`\n\n\`\`\`\n\n`);
        const remainingTokens = maxTokens - tokenCount - headerTokens;
        
        if (remainingTokens > 100) { // Only add if we have enough tokens for meaningful content
          const truncatedContent = truncateText(content, remainingTokens);
          context += `### ${file}\n\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
        }
        
        // Stop adding more files after this one
        break;
      }
    }
  }
  
  return context;
}

/**
 * Split long text into chunks that fit within token limits
 */
export function splitIntoChunks(text: string, maxTokenPerChunk: number): string[] {
  const chunks: string[] = [];
  
  if (estimateTokens(text) <= maxTokenPerChunk) {
    return [text];
  }
  
  // Split by paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit, start a new chunk
    if (estimateTokens(currentChunk + paragraph) > maxTokenPerChunk) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If a single paragraph is too big, we need to split it further
      if (estimateTokens(paragraph) > maxTokenPerChunk) {
        // Split by sentences (rough approximation)
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        
        for (const sentence of sentences) {
          if (estimateTokens(currentChunk + sentence) > maxTokenPerChunk) {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = '';
            }
            
            // If even a single sentence is too big, we need to split it by words
            if (estimateTokens(sentence) > maxTokenPerChunk) {
              let words = sentence.split(/\s+/);
              let partialSentence = '';
              
              for (const word of words) {
                if (estimateTokens(partialSentence + word) > maxTokenPerChunk) {
                  chunks.push(partialSentence);
                  partialSentence = word + ' ';
                } else {
                  partialSentence += word + ' ';
                }
              }
              
              if (partialSentence) {
                currentChunk = partialSentence;
              }
            } else {
              currentChunk = sentence + ' ';
            }
          } else {
            currentChunk += sentence + ' ';
          }
        }
      } else {
        currentChunk = paragraph + '\n\n';
      }
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}