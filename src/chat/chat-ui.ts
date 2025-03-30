/**
 * Get the HTML for the chat UI
 */
export function getChatHTML(): string {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Claude Chat</title>
      <style>
          body {
              font-family: var(--vscode-font-family);
              padding: 0;
              margin: 0;
              color: var(--vscode-editor-foreground);
              background-color: var(--vscode-editor-background);
              display: flex;
              flex-direction: column;
              height: 100vh;
          }
          
          .header {
              padding: 10px;
              border-bottom: 1px solid var(--vscode-panel-border);
              display: flex;
              justify-content: space-between;
              align-items: center;
          }
  
          .session-info {
              display: flex;
              align-items: center;
          }
          
          .session-name {
              margin-right: 10px;
              font-weight: bold;
          }
          
          .session-controls {
              display: flex;
              gap: 10px;
          }
          
          .chat-container {
              flex: 1;
              overflow-y: auto;
              padding: 20px;
          }
          
          .message {
              margin-bottom: 15px;
              max-width: 80%;
              padding: 10px 15px;
              border-radius: 5px;
          }
          
          .user-message {
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              align-self: flex-end;
              margin-left: auto;
          }
          
          .assistant-message {
              background-color: var(--vscode-editor-inactiveSelectionBackground);
              color: var(--vscode-editor-foreground);
              align-self: flex-start;
          }
          
          .input-area {
              padding: 15px;
              border-top: 1px solid var(--vscode-panel-border);
              display: flex;
          }
          
          .message-input {
              flex: 1;
              padding: 10px;
              border: 1px solid var(--vscode-input-border);
              background-color: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
              border-radius: 4px;
              margin-right: 10px;
          }
          
          button {
              padding: 8px 15px;
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              border-radius: 4px;
              cursor: pointer;
          }
          
          button:hover {
              background-color: var(--vscode-button-hoverBackground);
          }
          
          .clear-button {
              background-color: var(--vscode-errorForeground);
          }
          
          /* Style for code blocks in messages */
          pre {
              background-color: var(--vscode-textCodeBlock-background);
              padding: 10px;
              border-radius: 4px;
              overflow-x: auto;
          }
          
          code {
              font-family: var(--vscode-editor-font-family);
              font-size: var(--vscode-editor-font-size);
          }
      </style>
  </head>
  <body>
      <div class="header">
          <div class="session-info">
              <div class="session-name" id="sessionName">Chat with Claude</div>
              <div class="session-controls">
                  <button id="switchSessionButton">Switch Session</button>
                  <button id="newSessionButton">New Session</button>
              </div>
          </div>
          <button class="clear-button" id="clearButton">Clear Chat</button>
      </div>
      
      <div class="chat-container" id="chatContainer">
          <!-- Messages will be added here -->
      </div>
      
      <div class="input-area">
          <textarea class="message-input" id="messageInput" placeholder="Type your message..." rows="3"></textarea>
          <button id="sendButton">Send</button>
      </div>
      
      <script>
          const vscode = acquireVsCodeApi();
          const chatContainer = document.getElementById('chatContainer');
          const messageInput = document.getElementById('messageInput');
          const sendButton = document.getElementById('sendButton');
          const clearButton = document.getElementById('clearButton');
          const switchSessionButton = document.getElementById('switchSessionButton');
          const newSessionButton = document.getElementById('newSessionButton');
          const sessionNameElement = document.getElementById('sessionName');
          
          // Session tracking
          let currentSessionId = null;
          let currentSessionName = "Chat with Claude";
          
          // Initialize
          let messages = [];
          
          // Add event listeners
          sendButton.addEventListener('click', sendMessage);
          clearButton.addEventListener('click', clearChat);
          switchSessionButton.addEventListener('click', switchSession);
          newSessionButton.addEventListener('click', createNewSession);
          
          messageInput.addEventListener('keydown', event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
              }
          });
          
          // Function to send a message
          function sendMessage() {
              const text = messageInput.value.trim();
              if (!text) return;
              
              vscode.postMessage({
                  command: 'sendMessage',
                  text: text,
                  sessionId: currentSessionId
              });
              
              messageInput.value = '';
          }
          
          // Function to clear the chat
          function clearChat() {
              vscode.postMessage({
                  command: 'clearChat',
                  sessionId: currentSessionId
              });
          }
          
          // Function to switch session
          function switchSession() {
              vscode.postMessage({
                  command: 'switchSession'
              });
          }
          
          // Function to create a new session
          function createNewSession() {
              vscode.postMessage({
                  command: 'createSession'
              });
          }
          
          // Function to render a message in the chat
          function renderMessage(message) {
              const messageElement = document.createElement('div');
              messageElement.classList.add('message');
              messageElement.classList.add(message.role === 'user' ? 'user-message' : 'assistant-message');
              
              // Process markdown-like content (for code blocks)
              let content = message.content;
              
              // Replace code blocks with properly formatted HTML
              content = content.replace(/\`\`\`([\s\S]*?)\`\`\`/g, function(match, code) {
                  return \`<pre><code>\${code}</code></pre>\`;
              });
              
              // Replace inline code
              content = content.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
              
              // Handle line breaks
              content = content.replace(/\\n/g, '<br>');
              
              messageElement.innerHTML = content;
              chatContainer.appendChild(messageElement);
              
              // Scroll to bottom
              chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          
          // Handle messages from the extension
          window.addEventListener('message', event => {
              const message = event.data;
              switch (message.command) {
                  case 'updateChat':
                      // Clear the container
                      chatContainer.innerHTML = '';
                      
                      // Render all messages
                      message.messages.forEach(msg => {
                          renderMessage(msg);
                      });
                      break;
                      
                  case 'setSession':
                      currentSessionId = message.sessionId;
                      currentSessionName = message.sessionName;
                      sessionNameElement.textContent = currentSessionName;
                      break;
              }
          });
      </script>
  </body>
  </html>`;
  }