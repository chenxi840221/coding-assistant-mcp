import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  
  beforeAll(async () => {
    // Wait for extension to activate
    await vscode.extensions.getExtension('coding-assistant')?.activate();
  });

  it('Should be activated', () => {
    // Simple test to verify extension is active
    assert.ok(vscode.extensions.getExtension('coding-assistant')?.isActive);
  });

  it('Should register commands', () => {
    // Check if commands are registered
    return vscode.commands.getCommands(true).then((commands) => {
      assert.ok(commands.includes('claudeAssistant.askClaudeMCP'));
      assert.ok(commands.includes('claudeAssistant.openChatView'));
    });
  });
});