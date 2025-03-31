# Claude VS Code Assistant

A powerful VS Code extension that integrates Claude AI assistant directly into your coding workflow, enhancing productivity and providing intelligent coding assistance.

![Claude VS Code Assistant](https://via.placeholder.com/800x450.png?text=Claude+VS+Code+Assistant)

## Features

- **AI Chat Interface**: Chat with Claude directly within VS Code
- **Context-Aware Code Assistance**: Get intelligent help based on your current project and selected code
- **Code Generation**: Generate code snippets and entire files based on your specifications
- **Code Analysis**: Get insights into code structure, patterns, and potential improvements
- **Documentation Search**: Find relevant documentation without leaving your editor
- **Refactoring Suggestions**: Receive intelligent recommendations for code improvements

## Installation

### From VSIX (Recommended)

1. Download the `.vsix` file from the [releases page](https://github.com/yourusername/claude-vscode-assistant/releases)
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click "..." at the top of the Extensions view
5. Select "Install from VSIX..." and choose the downloaded file

### From Source

```bash
git clone https://github.com/yourusername/claude-vscode-assistant.git
cd claude-vscode-assistant
npm install
npm run compile
vsce package
# Then install the generated .vsix file as described above
```

## Setup

1. Get an API key from [Anthropic](https://www.anthropic.com/)
2. Open VS Code settings (File > Preferences > Settings)
3. Search for "Claude Assistant"
4. Enter your API key in the "Claude API Key" field

## Usage

### Chat Interface

1. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P on macOS)
2. Type "Claude: Open Chat View" and select it
3. The chat panel will open where you can ask questions and get responses

### Code Assistance

1. Select the code you want help with
2. Right-click and select "Ask Claude MCP" or use the command palette
3. Enter your question about the selected code
4. View Claude's response in the output panel

### Generate Code

1. Open the command palette
2. Type "Claude: Generate Code" and select it
3. Enter a description of the code you want to generate
4. Optionally provide a filename to save the generated code
5. The generated code will appear in a new file or in the output panel

## Extension Settings

* `claudeAssistant.apiKey`: Your Anthropic API key
* `claudeAssistant.model`: The Claude model to use (default: "claude-3-7-sonnet-20250219")
* `claudeAssistant.maxTokens`: Maximum number of tokens in Claude's responses
* `claudeAssistant.maxContextSize`: Maximum context size for Claude's understanding

## Keyboard Shortcuts

| Command | Shortcut (Windows/Linux) | Shortcut (macOS) |
|---------|--------------------------|------------------|
| Open Chat View | Ctrl+Alt+C | Cmd+Alt+C |
| Ask Claude MCP | Ctrl+Alt+A | Cmd+Alt+A |
| Generate Code | Ctrl+Alt+G | Cmd+Alt+G |

## Requirements

- VS Code version 1.60.0 or higher
- Node.js 14.x or higher
- An Anthropic API key with access to Claude models

## Privacy & Security

This extension sends code snippets and queries to Anthropic's API for processing. Please review Anthropic's [privacy policy](https://www.anthropic.com/privacy) for information on how your data is handled.

## Release Notes

### 1.0.0

- Initial release with chat, code assistance, and code generation features
- Support for Claude 3.7 Sonnet model
- Project structure analysis
- VS Code theme integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).

---

**Enjoy coding with Claude!** 🤖✨