// HTML/CSS/JS for chat UI with syntax highlighting and file button support
import { getFileButtonHTML } from './chat-ui-file-button';

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
      <!-- Add Highlight.js for code syntax highlighting -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
      <!-- Add common languages -->
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/typescript.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/javascript.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/python.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/json.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/css.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/xml.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/markdown.min.js"></script>
      
      <!-- Add marked.js for Markdown parsing -->
      <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
      
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
          }
          
          .message {
              margin-bottom: 15px;
              max-width: 90%;
              padding: 10px 15px;
              border-radius: 5px;
              line-height: 1.5;
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
              font-family: var(--vscode-font-family);
              resize: vertical;
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
              padding: 12px;
              border-radius: 6px;
              overflow-x: auto;
              margin: 10px 0;
              position: relative;
          }
          
          pre code {
              font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
              font-size: 13px;
              line-height: 1.4;
              tab-size: 4;
          }
          
          .code-actions {
              position: absolute;
              top: 5px;
              right: 5px;
              display: flex;
              gap: 5px;
          }
          
          .copy-button, .insert-button {
              padding: 4px 8px;
              font-size: 12px;
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              border-radius: 2px;
              cursor: pointer;
              opacity: 0.8;
          }
          
          .copy-button:hover, .insert-button:hover {
              opacity: 1;
              background-color: var(--vscode-button-hoverBackground);
          }
          
          code {
              font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
              font-size: 13px;
              background-color: var(--vscode-textCodeBlock-background);
              padding: 2px 4px;
              border-radius: 3px;
          }
          
          /* Add styling for markdown elements */
          .message h1, .message h2, .message h3, .message h4, .message h5, .message h6 {
              margin-top: 16px;
              margin-bottom: 8px;
              font-weight: 600;
              line-height: 1.25;
          }
          
          .message h1 {
              font-size: 2em;
              border-bottom: 1px solid var(--vscode-panel-border);
              padding-bottom: 0.3em;
          }
          
          .message h2 {
              font-size: 1.5em;
              border-bottom: 1px solid var(--vscode-panel-border);
              padding-bottom: 0.3em;
          }
          
          .message h3 {
              font-size: 1.25em;
          }
          
          .message p {
              margin-top: 0;
              margin-bottom: 10px;
          }
          
          .message ul, .message ol {
              margin-top: 0;
              margin-bottom: 10px;
              padding-left: 2em;
          }
          
          .message blockquote {
              margin: 0;
              padding: 0 1em;
              color: var(--vscode-textPreformat-foreground);
              border-left: 0.25em solid var(--vscode-textLink-activeForeground);
          }
          
          .message table {
              border-collapse: collapse;
              margin-bottom: 10px;
              width: 100%;
              overflow: auto;
          }
          
          .message table th {
              font-weight: 600;
              background-color: var(--vscode-editor-inactiveSelectionBackground);
          }
          
          .message table th, .message table td {
              padding: 6px 13px;
              border: 1px solid var(--vscode-panel-border);
          }
          
          .message table tr:nth-child(2n) {
              background-color: var(--vscode-editor-lineHighlightBackground);
          }
          
          /* Message role indicator */
          .message-header {
              margin-bottom: 5px;
              font-size: 0.8em;
              color: var(--vscode-descriptionForeground);
              display: flex;
              align-items: center;
          }
          
          .message-timestamp {
              margin-left: auto;
              font-size: 0.8em;
              color: var(--vscode-descriptionForeground);
          }
          
          /* Loading indicator */
          .typing-indicator {
              display: flex;
              align-items: center;
              margin: 10px 0;
          }
          
          .typing-indicator span {
              height: 8px;
              width: 8px;
              margin: 0 1px;
              background-color: var(--vscode-descriptionForeground);
              display: block;
              border-radius: 50%;
              opacity: 0.4;
              animation: typing 1s infinite;
          }
          
          .typing-indicator span:nth-child(1) {
              animation-delay: 0s;
          }
          
          .typing-indicator span:nth-child(2) {
              animation-delay: 0.2s;
          }
          
          .typing-indicator span:nth-child(3) {
              animation-delay: 0.4s;
          }
          
          @keyframes typing {
              0% {
                  opacity: 0.4;
                  transform: translateY(0);
              }
              50% {
                  opacity: 1;
                  transform: translateY(-4px);
              }
              100% {
                  opacity: 0.4;
                  transform: translateY(0);
              }
          }
          
          /* File button component styles */
          .file-button-container {
            margin: 0;
            padding: 0;
          }
          
          .file-input-row {
            display: flex;
            margin-bottom: 4px;
            gap: 4px;
          }
          
          .file-name-input {
            flex: 1;
            padding: 2px 4px;
            font-size: 11px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
          }
          
          .file-button {
            padding: 2px 4px;
            font-size: 11px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            white-space: nowrap;
          }
          
          .file-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          
          .file-search-result {
            font-size: 10px;
            margin-top: 2px;
            min-height: 14px;
          }
          
          .file-exists {
            color: var(--vscode-terminal-ansiGreen);
          }
          
          .file-not-found {
            color: var(--vscode-terminal-ansiYellow);
          }
      </style>
  </head>
  <body>
      <div class="header">
          <h2>Chat with Claude</h2>
          <div>
            <button id="exportButton">Export Chat</button>
            <button class="clear-button" id="clearButton">Clear Chat</button>
          </div>
      </div>
      
      <div class="chat-container" id="chatContainer">
          <!-- Messages will be added here -->
          <div class="typing-indicator" id="typingIndicator" style="display: none;">
              <span></span>
              <span></span>
              <span></span>
          </div>
      </div>
      
      <div class="input-area">
          <textarea class="message-input" id="messageInput" placeholder="Type your message..." rows="3"></textarea>
          <button id="sendButton">Send</button>
      </div>
      
      <script>
          (function() {
              console.log("Chat UI script initializing");
              const vscode = acquireVsCodeApi();
              const chatContainer = document.getElementById('chatContainer');
              const messageInput = document.getElementById('messageInput');
              const sendButton = document.getElementById('sendButton');
              const clearButton = document.getElementById('clearButton');
              const exportButton = document.getElementById('exportButton');
              const typingIndicator = document.getElementById('typingIndicator');
              
              // Initialize
              let messages = [];
              
              // Configure marked.js options
              marked.setOptions({
                  highlight: function(code, lang) {
                      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                      return hljs.highlight(code, { language }).value;
                  },
                  langPrefix: 'hljs language-',
                  gfm: true,
                  breaks: true
              });
              
              // Add event listeners
              console.log("Setting up event listeners");
              
              // Send button event
              sendButton.addEventListener('click', function() {
                  console.log("Send button clicked");
                  sendMessage();
              });
              
              // Clear button event
              clearButton.addEventListener('click', function() {
                  console.log("Clear button clicked");
                  clearChat();
              });
              
              // Export button event
              exportButton.addEventListener('click', function() {
                  console.log("Export button clicked");
                  exportChat();
              });
              
              // Enter key in message input
              messageInput.addEventListener('keydown', function(event) {
                  if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                  }
              });
              
              // Function to send a message
              function sendMessage() {
                  const text = messageInput.value.trim();
                  console.log("Sending message:", text);
                  
                  if (!text) return;
                  
                  // Show typing indicator
                  typingIndicator.style.display = 'flex';
                  chatContainer.appendChild(typingIndicator);
                  chatContainer.scrollTop = chatContainer.scrollHeight;
                  
                  vscode.postMessage({
                      command: 'sendMessage',
                      text: text
                  });
                  
                  messageInput.value = '';
              }
              
              // Function to clear the chat
              function clearChat() {
                  console.log("Clearing chat");
                  vscode.postMessage({
                      command: 'clearChat'
                  });
              }
              
              // Function to export chat history
              function exportChat() {
                  console.log("Exporting chat");
                  if (messages.length === 0) {
                      vscode.postMessage({
                          command: 'showInfo',
                          text: 'No messages to export'
                      });
                      return;
                  }
                  
                  // Format chat history as markdown
                  let exportText = '# Claude Chat History\\n\\n';
                  exportText += \`Exported on \${new Date().toLocaleString()}\\n\\n\`;
                  
                  messages.forEach(msg => {
                      const role = msg.role === 'user' ? 'You' : 'Claude';
                      exportText += \`## \${role}\\n\\n\${msg.content}\\n\\n\`;
                  });
                  
                  vscode.postMessage({
                      command: 'exportChat',
                      text: exportText
                  });
              }
              
              // Add copy button and file button to code blocks
              function addButtonsToCodeBlocks() {
                  const codeBlocks = document.querySelectorAll('pre code');
                  codeBlocks.forEach((codeElement) => {
                      const pre = codeElement.parentElement;
                      
                      // Check if actions div already exists
                      if (pre.querySelector('.code-actions')) {
                          return;
                      }
                      
                      // Create actions container
                      const actionsDiv = document.createElement('div');
                      actionsDiv.className = 'code-actions';
                      pre.appendChild(actionsDiv);
                      
                      // Add copy button
                      const copyButton = document.createElement('button');
                      copyButton.className = 'copy-button';
                      copyButton.textContent = 'Copy';
                      
                      copyButton.addEventListener('click', () => {
                          const code = codeElement.textContent;
                          navigator.clipboard.writeText(code)
                              .then(() => {
                                  copyButton.textContent = 'Copied!';
                                  setTimeout(() => {
                                      copyButton.textContent = 'Copy';
                                  }, 2000);
                              })
                              .catch(err => {
                                  console.error('Failed to copy: ', err);
                                  copyButton.textContent = 'Error!';
                                  setTimeout(() => {
                                      copyButton.textContent = 'Copy';
                                  }, 2000);
                              });
                      });
                      
                      actionsDiv.appendChild(copyButton);
                      
                      // Add file button container
                      const fileButtonContainer = document.createElement('div');
                      fileButtonContainer.innerHTML = ${getFileButtonHTML()};
                      actionsDiv.appendChild(fileButtonContainer.firstElementChild);
                      
                      // Add insert button
                      const insertButton = document.createElement('button');
                      insertButton.className = 'insert-button';
                      insertButton.textContent = 'Insert';
                      
                      insertButton.addEventListener('click', () => {
                          const code = codeElement.textContent;
                          vscode.postMessage({
                              command: 'insertAtCursor',
                              text: code
                          });
                      });
                      
                      actionsDiv.appendChild(insertButton);
                  });
              }
              
              // Function to render a message in the chat
              function renderMessage(message) {
                  console.log("Rendering message:", message);
                  // Hide typing indicator
                  typingIndicator.style.display = 'none';
                  
                  const messageElement = document.createElement('div');
                  messageElement.classList.add('message');
                  messageElement.classList.add(message.role === 'user' ? 'user-message' : 'assistant-message');
                  
                  // Add message header with role
                  const headerElement = document.createElement('div');
                  headerElement.classList.add('message-header');
                  headerElement.textContent = message.role === 'user' ? 'You' : 'Claude';
                  
                  // Add timestamp
                  const timestamp = document.createElement('span');
                  timestamp.classList.add('message-timestamp');
                  timestamp.textContent = new Date().toLocaleString();
                  headerElement.appendChild(timestamp);
                  
                  messageElement.appendChild(headerElement);
                  
                  // Process content with marked.js for markdown rendering
                  let content = message.content;
                  
                  // Create a div for the content
                  const contentElement = document.createElement('div');
                  contentElement.classList.add('message-content');
                  contentElement.innerHTML = marked.parse(content);
                  
                  messageElement.appendChild(contentElement);
                  chatContainer.appendChild(messageElement);
                  
                  // Apply syntax highlighting
                  hljs.highlightAll();
                  
                  // Add buttons to code blocks
                  addButtonsToCodeBlocks();
                  
                  // Scroll to bottom
                  chatContainer.scrollTop = chatContainer.scrollHeight;
              }
              
              // Handle messages from the extension
              window.addEventListener('message', event => {
                  const message = event.data;
                  console.log("Received message from extension:", message);
                  
                  switch (message.command) {
                      case 'updateChat':
                          console.log("Updating chat with messages:", message.messages);
                          
                          // Clear the container but keep the typing indicator
                          while (chatContainer.firstChild !== typingIndicator && chatContainer.firstChild) {
                              chatContainer.removeChild(chatContainer.firstChild);
                          }
                          
                          // Store messages
                          messages = message.messages;
                          
                          // Render all messages
                          message.messages.forEach(msg => {
                              renderMessage(msg);
                          });
                          break;
                          
                      case 'searchResult':
                          // Handle file search result
                          const fileSearchResult = document.getElementById('fileSearchResult');
                          if (fileSearchResult) {
                              if (message.found) {
                                  fileSearchResult.textContent = \`File exists: \${message.filePath}\`;
                                  fileSearchResult.className = 'file-search-result file-exists';
                                  
                                  // Update button
                                  const fileButton = document.getElementById('createUpdateFileBtn');
                                  if (fileButton) {
                                      fileButton.textContent = 'Update File';
                                  }
                              } else {
                                  fileSearchResult.textContent = \`File not found. Will create new file.\`;
                                  fileSearchResult.className = 'file-search-result file-not-found';
                                  
                                  // Update button
                                  const fileButton = document.getElementById('createUpdateFileBtn');
                                  if (fileButton) {
                                      fileButton.textContent = 'Create File';
                                  }
                              }
                          }
                          break;
                          
                      case 'fileCreated':
                          // Handle file creation/update result
                          const resultMsg = document.getElementById('fileSearchResult');
                          if (resultMsg) {
                              resultMsg.textContent = message.result;
                              resultMsg.className = 'file-search-result file-exists';
                          }
                          break;
                  }
              });
              
              console.log("Chat UI initialization complete");
          })();
      </script>
  </body>
  </html>`;
  }