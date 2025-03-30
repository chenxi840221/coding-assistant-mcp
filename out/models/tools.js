"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availableTools = exports.searchDocsTool = exports.suggestRefactoringTool = exports.analyzeCodeTool = void 0;
// Code analysis tool definition
exports.analyzeCodeTool = {
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
exports.suggestRefactoringTool = {
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
exports.searchDocsTool = {
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
// List of all available tools
exports.availableTools = [
    exports.analyzeCodeTool,
    exports.suggestRefactoringTool,
    exports.searchDocsTool
];
//# sourceMappingURL=tools.js.map