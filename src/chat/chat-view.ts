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

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Open a chat view with the given session ID
   */
  public openChatView(sessionId?: string): void {
    console.log('Opening chat view...');
    
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If no sessionId is provided, use the general chat ID
    const chatId = sessionId || 'general-chat';
    
    console.log(`Using chat ID: ${chatId}`);
    
    // Check if we already have a panel for this chat
    const existingPanel = this.webViewPanels.get(chatId);
    
    if (existingPanel) {
      // If we do, show it
      console.log('Found existing panel, revealing it');
      existingPanel.reveal(columnToShowIn);
      return;
    }
    
    // Otherwise, create a new panel
    console.log('Creating new chat panel');
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
    const session = getChatSession(chatId);
    console.log(`Chat session created/retrieved: ${session.id}`);
    
    // Set the HTML content
    const html = getChatHTML();
    console.log('Setting HTML content for webview');
    panel.webview.html = html;
    
    // Store the panel reference
    this.webViewPanels.set(chatId, panel);
    
    // Handle messages from the webview
    console.log('Setting up message handler');
    panel.webview.onDidReceiveMessage(
      async message => {
        console.log('Received message from webview:', message);
        
        switch (message.command) {
          case 'sendMessage':
            console.log('Handling sendMessage command with text:', message.text);
            await handleChatMessage(
              session.id, 
              message.text, 
              (updatedSession) => {
                console.log('Callback called, updating webview with new content');
                this.updateChatWebview(panel.webview, updatedSession);
              }
            );
            break;
          case 'clearChat':
            console.log('Handling clearChat command');
            clearChatSession(session.id);
            this.updateChatWebview(panel.webview, session);
            break;
          case 'exportChat':
            console.log('Handling exportChat command');
            this.exportChatHistory(message.text);
            break;
          case 'showInfo':
            console.log('Handling showInfo command');
            vscode.window.showInformationMessage(message.text);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
    
    // Update the webview with existing messages
    console.log('Updating webview with existing messages');
    this.updateChatWebview(panel.webview, session);
    
    // Handle the panel being closed
    panel.onDidDispose(
      () => {
        console.log(`Panel for chat ${chatId} disposed`);
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
    const messages = session.messages.filter(msg => msg.role !== 'system');
    console.log(`Sending ${messages.length} messages to webview`);
    
    try {
      webview.postMessage({
        command: 'updateChat',
        messages: messages
      });
      console.log('Message posted to webview successfully');
    } catch (error) {
      console.error('Error posting message to webview:', error);
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