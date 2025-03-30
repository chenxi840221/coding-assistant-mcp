import * as vscode from 'vscode';
import { ChatSession } from '../models/interfaces';
import { getChatHTML } from './chat-ui';
import { 
  getChatSession, 
  clearChatSession, 
  handleChatMessage 
} from './chat-manager';

/**
 * Manages WebView panels for chat UI
 */
export class WebViewManager {
  private context: vscode.ExtensionContext;
  private webViewPanels: Map<string, vscode.WebviewPanel> = new Map();
  private currentSessionId: string | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Open a chat view
   */
  public openChatView(sessionId?: string): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If sessionId is provided, use it; otherwise use current session or create a new one
    let session: ChatSession;
    
    if (sessionId && this.currentSessionId !== sessionId) {
      session = getChatSession(sessionId);
      this.currentSessionId = sessionId;
    } else {
      session = getChatSession(this.currentSessionId);
      if (!this.currentSessionId) {
        this.currentSessionId = session.id;
      }
    }
    
    // Check if we already have a panel
    const existingPanel = this.webViewPanels.get('chat');
    
    if (existingPanel) {
      // If we do, show it
      existingPanel.reveal(columnToShowIn);
      this.updateChatWebview(existingPanel.webview, session);
      return;
    }
    
    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'claudeChat',
      `Claude Chat: ${session.name}`,
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );
    
    // Set the HTML content
    panel.webview.html = getChatHTML();
    
    // Store the panel reference
    this.webViewPanels.set('chat', panel);
    
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendMessage':
            await handleChatMessage(
              this.currentSessionId!,
              message.text,
              (updatedSession) => this.updateChatWebview(panel.webview, updatedSession)
            );
            break;
          case 'clearChat':
            await clearChatSession(this.currentSessionId!);
            this.updateChatWebview(panel.webview, getChatSession(this.currentSessionId));
            break;
          case 'switchSession':
            // Implementation for switching between sessions would go here
            break;
          case 'createSession':
            // Implementation for creating a new session would go here
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
    
    // Update the webview with existing messages
    this.updateChatWebview(panel.webview, session);
    
    // Handle the panel being closed
    panel.onDidDispose(
      () => {
        this.webViewPanels.delete('chat');
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
   * Dispose all webview panels
   */
  public dispose(): void {
    this.webViewPanels.forEach(panel => panel.dispose());
    this.webViewPanels.clear();
  }
}