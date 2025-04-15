# Claude Coding Assistant - Deployment Instructions

Follow these instructions to properly deploy your VS Code extension as a VSIX package that works correctly when installed.

## Preparation Steps

### 1. Create Required Directories and Files

First, create the necessary directory structure:

```bash
# Create media directory for icons
mkdir -p media
```

### 2. Add Icon Files

Create and add both icon files:

1. Copy the SVG icon for the activity bar:
   - Create file `media/claude-icon.svg` with the SVG content provided

2. Create a PNG icon for the extension:
   - Create a 128x128 PNG icon
   - Save as `media/claude-icon.png`

### 3. Update Configuration Files

Update these files with the provided fixed versions:

1. Replace `package.json` with the fixed version
2. Replace `.vscodeignore` with the fixed version
3. Update `src/extension.ts` with the enhanced version with better logging
4. Update `src/services/claudeService.ts` to remove the hardcoded API key

### 4. Build and Package

Build and package your extension:

```bash
# Install dependencies if needed
npm install

# Build the extension
npm run compile

# Package the extension
npx vsce package
```

This will create a `.vsix` file in your project directory.

## Installation and Debugging

### Installing the VSIX

1. In VS Code, go to Extensions view (Ctrl+Shift+X)
2. Click the "..." menu (top-right) and select "Install from VSIX..."
3. Choose the .vsix file you created

### Debugging Installation Issues

If you encounter issues with the installed extension:

1. Check the Developer Tools console:
   - Help > Toggle Developer Tools
   - Look for errors related to your extension

2. Check the Output panel:
   - View > Output
   - Select "Claude Coding Assistant" from the dropdown

3. Verify extension loading:
   - Open command palette (Ctrl+Shift+P)
   - Type "Developer: Show Running Extensions"
   - Check if your extension is listed and active

## Common Issues and Solutions

### Extension Not Appearing

If the extension doesn't appear in the activity bar:

1. Check package.json for correct viewsContainers configuration
2. Ensure icon files exist in the right location
3. Verify activation events are properly configured

### Commands Not Working

If commands don't work:

1. Check command registrations in extension.ts
2. Verify command IDs match between code and package.json
3. Check for errors in the activation process

### Missing Resources

If resources are missing:

1. Check .vscodeignore to ensure necessary files are not excluded
2. Make sure media files are properly included in the VSIX

## Additional Notes

- Remember to restart VS Code after installing the VSIX
- If making changes, always create a new VSIX and reinstall
- Clear VS Code cache if problems persist (Help > Clear Editor State)