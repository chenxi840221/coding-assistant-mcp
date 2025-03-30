// Refactoring suggestions tool
/**
 * Suggest refactoring options for the given code
 */
export function suggestRefactoring(code: string, issues: string[]): string {
    return `
  ## Refactoring Suggestions
  
  ${issues.length > 0 ? 
    `Based on the identified issues: ${issues.join(', ')}` : 
    'Based on code analysis:'}
  
  ### Suggested changes
  1. Extract repeated logic into helper functions
  2. Use more descriptive variable names
  3. Add comprehensive error handling
  4. Ensure consistent code style
  
  ### Example implementation
  \`\`\`
  ${generateRefactoredExample(code)}
  \`\`\`
  `;
  }
  
  /**
   * Generate a refactored example of the code
   */
  function generateRefactoredExample(code: string): string {
    // For demo purposes, just return a slightly modified version of the input
    const lines = code.split('\n');
    if (lines.length > 10) {
      // Return a simplified version for demo
      return `// Refactored version - simplified for clarity
  ${lines[0]}
  ${lines[1]}
  
  // Extracted helper function
  function helperFunction(params) {
    // Implementation details
    return processedResult;
  }
  
  ${lines[lines.length - 3]}
  ${lines[lines.length - 2]}
  ${lines[lines.length - 1]}`;
    }
    return code;
  }