import { MCPTool } from './interfaces';

// Code analysis tool definition
export const analyzeCodeTool: MCPTool = {
  name: "analyze_code",
  description: "Analyze code to identify patterns, issues, and potential improvements",
  input_schema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The code to analyze"
      },
      language: {
        type: "string",
        description: "The programming language of the code"
      }
    },
    required: ["code"]
  }
};

// Refactoring suggestion tool definition
export const suggestRefactoringTool: MCPTool = {
  name: "suggest_refactoring",
  description: "Suggest refactoring options for the given code",
  input_schema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The code to refactor"
      },
      issues: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of issues to address in the refactoring"
      }
    },
    required: ["code"]
  }
};

// Documentation search tool definition
export const searchDocsTool: MCPTool = {
  name: "search_docs",
  description: "Search documentation for a specific API, function, or concept",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query"
      },
      language: {
        type: "string",
        description: "The programming language context"
      }
    },
    required: ["query"]
  }
};

// Code generation tool definition
export const generateCodeTool: MCPTool = {
  name: "generate_code",
  description: "Generate source code based on a specification",
  input_schema: {
    type: "object",
    properties: {
      specification: {
        type: "string",
        description: "Description of the code to generate"
      },
      language: {
        type: "string",
        description: "Programming language to use"
      },
      filename: {
        type: "string",
        description: "Optional filename for the generated code"
      }
    },
    required: ["specification", "language"]
  }
};

// List of all available tools
export const availableTools: MCPTool[] = [
  analyzeCodeTool,
  suggestRefactoringTool,
  searchDocsTool,
  generateCodeTool  // Add the new tool here
];