// src/chat/chat-ui.ts

/**
 * Get the HTML for the chat UI
 */
export function getChatHTML(): string {
    return `<html lang="en">
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
          
          .chat-container {
              flex: 1;
              overflow-y: auto;
              padding: 20px;
              display: flex;
              flex-direction: column;
          }
          
          .message {
              margin-bottom: 15px;
              max-width: 85%;
              padding: 10px 15px;
              border-radius: 5px;
              line-height: 1.5;
          }
          
          .user-message {
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              align-self: flex-end;
              margin-left: auto;
              border-radius: 10px 10px 2px 10px;
          }
          
          .assistant-message {
              background-color: var(--vscode-editor-inactiveSelectionBackground);
              color: var(--vscode-editor-foreground);
              align-self: flex-start;
              border-radius: 10px 10px 10px 2px;
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
              resize: vertical;
              min-height: 40px;
              max-height: 200px;
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
              margin-left: 10px;
          }
          
          /* Style for code blocks in messages */
          pre {
              background-color: var(--vscode-textCodeBlock-background);
              padding: 10px;
              border-radius: 4px;
              overflow-x: auto;
              position: relative;
          }
          
          code {
              font-family: var(--vscode-editor-font-family);
              font-size: var(--vscode-editor-font-size);
          }
          
          /* Copy button for code blocks */
          .copy-button {
              position: absolute;
              top: 5px;
              right: 5px;
              padding: 4px 8px;
              font-size: 12px;
              opacity: 0.7;
          }
          
          .copy-button:hover {
              opacity: 1;
          }
          
          /* Insert button for code blocks */
          .insert-button {
              position: absolute;
              top: 5px;
              right: 70px;
              padding: 4px 8px;
              font-size: 12px;
              opacity: 0.7;
              background-color: var(--vscode-button-secondaryBackground);
              color: var(--vscode-button-secondaryForeground);
          }
          
          .insert-button:hover {
              opacity: 1;
          }
          
          /* Loading indicator */
          .loading {
              display: flex;
              align-items: center;
              color: var(--vscode-descriptionForeground);
              margin-bottom: 15px;
          }
          
          .loading-dots {
              display: inline-block;
              margin-left: 10px;
          }
          
          .loading-dots span {
              animation: loading 1.4s infinite;
              opacity: 0;
              display: inline-block;
              margin-right: 4px;
          }
          
          .loading-dots span:nth-child(2) {
              animation-delay: 0.2s;
          }
          
          .loading-dots span:nth-child(3) {
              animation-delay: 0.4s;
          }
          
          @keyframes loading {
              0% { opacity: 0; }
              50% { opacity: 1; }
              100% { opacity: 0; }
          }
      </style>
  </head>
  <body>
      <div class="header">
          <h2>Chat with Claude</h2>
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
          
          // Initialize
          let messages = [];
          let isWaitingForResponse = false;
          
          // Add event listeners
          sendButton.addEventListener('click', sendMessage);
          clearButton.addEventListener('click', clearChat);
          messageInput.addEventListener('keydown', event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
              }
          });
          
          // Function to send a message
          function sendMessage() {
              const text = messageInput.value.trim();
              if (!text || isWaitingForResponse) return;
              
              vscode.postMessage({
                  command: 'sendMessage',
                  text: text
              });
              
              messageInput.value = '';
              
              // Show loading indicator
              isWaitingForResponse = true;
              const loadingElement = document.createElement('div');
              loadingElement.classList.add('loading');
              loadingElement.innerHTML = 'Claude is thinking<div class="loading-dots"><span>.</span><span>.</span><span>.</span></div>';
              chatContainer.appendChild(loadingElement);
              chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          
          // Function to clear the chat
          function clearChat() {
              vscode.postMessage({
                  command: 'clearChat'
              });
          }
          
          // Function to copy code to clipboard
          function copyCode(button) {
              const preElement = button.parentElement;
              const codeElement = preElement.querySelector('code');
              const text = codeElement.textContent;
              
              navigator.clipboard.writeText(text)
                  .then(() => {
                      button.textContent = 'Copied!';
                      setTimeout(() => {
                          button.textContent = 'Copy';
                      }, 2000);
                  })
                  .catch(err => {
                      console.error('Failed to copy: ', err);
                  });
          }
          
          // Function to insert code to editor
          function insertCode(button) {
              const preElement = button.parentElement;
              const codeElement = preElement.querySelector('code');
              const text = codeElement.textContent;
              
              vscode.postMessage({
                  command: 'insertCode',
                  code: text
              });
              
              button.textContent = 'Inserted!';
              setTimeout(() => {
                  button.textContent = 'Insert';
              }, 2000);
          }
          
          // Function to render a message in the chat
          function renderMessage(message) {
              // Remove loading indicator if it exists
              const loadingElement = document.querySelector('.loading');
              if (loadingElement) {
                  chatContainer.removeChild(loadingElement);
              }
              
              isWaitingForResponse = false;
              
              const messageElement = document.createElement('div');
              messageElement.classList.add('message');
              messageElement.classList.add(message.role === 'user' ? 'user-message' : 'assistant-message');
              
              // Process markdown-like content (for code blocks)
              let content = message.content;
              
              // Replace code blocks with properly formatted HTML and add copy/insert buttons
              content = content.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, language, code) {
                  return `<pre><button class="copy-button" onclick="copyCode(this)">Copy</button><button class="insert-button" onclick="insertCode(this)">Insert</button><code class="language-${language}">${code}</code></pre>`;
              });
              
              // Replace inline code
              content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
              
              // Handle line breaks
              content = content.replace(/\n/g, '<br>');
              
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
              }
          });
      </script>
  </body>
  </html>`;
}