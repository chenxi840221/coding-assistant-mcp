// WebView implementation for chat
import * as vscode from 'vscode';
import { ChatSession } from '../models/interfaces';
import { getChatHTML } from './chat-ui';
import { 
  chatSessions, 
  clearChatSession, 
  getChatSession,
  handleChatMessage 
} from './chat-manager';

/**
 * Manages WebView panels for chat UI
 */
export class WebViewManager {
  private context: vscode.ExtensionContext;
  private webViewPanels: Map<string, vscode.WebviewPanel> = new Map();
  private view?: vscode.WebviewView;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Open a chat view with the given session ID
   */
  public openChatView(sessionId?: string): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If no sessionId is provided, use the general chat ID
    const chatId = sessionId || 'general-chat';
    
    // Check if we already have a panel for this chat
    const existingPanel = this.webViewPanels.get(chatId);
    
    if (existingPanel) {
      // If we do, show it
      existingPanel.reveal(columnToShowIn);
      return;
    }
    
    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'claudeChat',
      'Claude Chat',
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );
    
    // Get or create chat session
    const session = getChatSession(sessionId);
    
    // Set the HTML content
    panel.webview.html = getChatHTML();
    
    // Store the panel reference
    this.webViewPanels.set(chatId, panel);
    
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async message => {
        this.handleWebViewMessage(message, session);
      },
      undefined,
      this.context.subscriptions
    );
    
    // Update the webview with existing messages
    this.updateChatWebview(panel.webview, session);
    
    // Handle the panel being closed
    panel.onDidDispose(
      () => {
        this.webViewPanels.delete(chatId);
      },
      null,
      this.context.subscriptions
    );
  }

  /**
   * Update the chat webview with new messages
   */
  private updateChatWebview(webview: vscode.Webview, session: ChatSession): void {
    webview.postMessage({
      command: 'updateChat',
      messages: session.messages.filter(msg => msg.role !== 'system')
    });
  }

  /**
   * Handle a message from the webview
   */
  private handleWebViewMessage(message: any, session: ChatSession): void {
    switch (message.command) {
      case 'sendMessage':
        handleChatMessage(
          session.id, 
          message.text, 
          (updatedSession) => this.updateChatWebview(this.view!.webview, updatedSession)
        );
        break;
        
      case 'clearChat':
        clearChatSession(session.id);
        this.updateChatWebview(this.view!.webview, session);
        break;
        
      case 'exportChat':
        this.exportChatHistory(message.text);
        break;
        
      case 'showInfo':
        vscode.window.showInformationMessage(message.text);
        break;
    }
  }

  /**
   * Export chat history to a markdown file
   */
  private async exportChatHistory(content: string): Promise<void> {
    try {
      // Ask for file path
      const uri = await vscode.window.showSaveDialog({
        filters: {
          'Markdown': ['md'],
          'Text Files': ['txt']
        },
        defaultUri: vscode.Uri.file('claude_chat_history.md')
      });
      
      if (uri) {
        // Write content to file
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        vscode.window.showInformationMessage(`Chat history exported to ${uri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error exporting chat history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Dispose all webview panels
   */
  public dispose(): void {
    this.webViewPanels.forEach(panel => panel.dispose());
    this.webViewPanels.clear();
  }
}