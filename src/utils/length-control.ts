import * as vscode from 'vscode';
import * as path from 'path';
import { getMaxFileLength } from '../config/settings';

/**
 * Controls the length of generated code files
 */
export class FileLengthController {
  /**
   * Split code into multiple files if it exceeds maximum length
   * @param code The generated code
   * @param language The programming language
   * @param baseFilename The base filename to use
   * @returns An array of file objects with filename and content
   */
  public static splitCodeIntoFiles(
    code: string,
    language: string,
    baseFilename: string
  ): Array<{filename: string, content: string}> {
    const maxLines = getMaxFileLength();
    const lines = code.split('\n');
    
    // If the code is under the limit, return as a single file
    if (lines.length <= maxLines) {
      return [{
        filename: baseFilename,
        content: code
      }];
    }
    
    // For longer code, we need to intelligently split it
    return this.intelligentlySplitCode(lines, language, baseFilename, maxLines);
  }
  
  /**
   * Intelligently split code into multiple files based on language-specific patterns
   */
  private static intelligentlySplitCode(
    lines: string[],
    language: string,
    baseFilename: string,
    maxLines: number
  ): Array<{filename: string, content: string}> {
    // Different languages have different ways to split code
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.splitJsCode(lines, baseFilename, maxLines);
      case 'python':
        return this.splitPythonCode(lines, baseFilename, maxLines);
      case 'java':
      case 'csharp':
        return this.splitJavaStyleCode(lines, baseFilename, maxLines);
      default:
        // For unknown languages, just do a simple line-based split
        return this.simpleLineSplit(lines, language, baseFilename, maxLines);
    }
  }
  
  /**
   * Split JavaScript/TypeScript code into multiple files
   */
  private static splitJsCode(
    lines: string[],
    baseFilename: string,
    maxLines: number
  ): Array<{filename: string, content: string}> {
    const files: Array<{filename: string, content: string}> = [];
    const extension = path.extname(baseFilename);
    const baseName = path.basename(baseFilename, extension);
    
    // Identify imports/requires to include in all files
    const imports: string[] = [];
    let codeStartIndex = 0;
    
    // Find all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('const ') && line.includes('require(')) {
        imports.push(lines[i]);
        codeStartIndex = i + 1;
      } else if (line !== '' && !line.startsWith('//')) {
        // First non-empty, non-comment, non-import line
        break;
      }
    }
    
    // Add preamble (imports, etc.)
    const preamble = imports.join('\n') + (imports.length > 0 ? '\n\n' : '');
    
    // Find class and function declarations to split on
    const codeSegments: {start: number, end: number, name: string}[] = [];
    let currentSegmentStart = codeStartIndex;
    let currentSegmentName = "main";
    let bracketStack = 0;
    let inMultilineComment = false;
    
    for (let i = codeStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for multiline comment boundaries
      if (line.includes('/*')) {
        inMultilineComment = true;
      }
      if (line.includes('*/')) {
        inMultilineComment = false;
      }
      
      // Skip processing content inside multiline comments
      if (inMultilineComment) {
        continue;
      }
      
      // Count opening and closing brackets
      const openBrackets = (line.match(/{/g) || []).length;
      const closeBrackets = (line.match(/}/g) || []).length;
      bracketStack += openBrackets - closeBrackets;
      
      // Look for function or class declarations at the top level
      if (bracketStack === 0 && i > codeStartIndex) {
        // End of a top-level block
        codeSegments.push({
          start: currentSegmentStart,
          end: i,
          name: currentSegmentName
        });
        
        currentSegmentStart = i + 1;
        currentSegmentName = "segment" + codeSegments.length;
      }
      
      // Capture names of functions and classes for better file naming
      if (bracketStack === 0 || (bracketStack === 1 && openBrackets === 1)) {
        // Check if this line is a function or class declaration
        const functionMatch = line.match(/(?:function|const|let|var)\s+(\w+)/);
        const arrowFunctionMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
        const classMatch = line.match(/class\s+(\w+)/);
        
        if (functionMatch) {
          currentSegmentName = functionMatch[1];
        } else if (arrowFunctionMatch) {
          currentSegmentName = arrowFunctionMatch[1];
        } else if (classMatch) {
          currentSegmentName = classMatch[1];
        }
      }
    }
    
    // Add the final segment
    if (currentSegmentStart < lines.length) {
      codeSegments.push({
        start: currentSegmentStart,
        end: lines.length - 1,
        name: currentSegmentName
      });
    }
    
    // Now create files from the segments
    if (codeSegments.length === 0) {
      // If no segments were found, return the whole file
      files.push({
        filename: baseFilename,
        content: lines.join('\n')
      });
      return files;
    }
    
    let currentFileContent: string[] = [];
    let currentFileSegments: string[] = [];
    
    for (const segment of codeSegments) {
      const segmentLines = lines.slice(segment.start, segment.end + 1);
      
      // If adding this segment would exceed the line limit, create a new file
      if (currentFileContent.length + segmentLines.length > maxLines && currentFileContent.length > 0) {
        // Create a file from accumulated segments
        files.push({
          filename: `${baseName}.${currentFileSegments.join('-')}${extension}`,
          content: preamble + currentFileContent.join('\n')
        });
        
        // Reset for next file
        currentFileContent = [];
        currentFileSegments = [];
      }
      
      // Add this segment to the current file
      currentFileContent.push(...segmentLines);
      currentFileSegments.push(segment.name);
    }
    
    // Add the last file if there's any content left
    if (currentFileContent.length > 0) {
      files.push({
        filename: currentFileSegments.length === 1 && codeSegments.length > 1
          ? `${baseName}.${currentFileSegments[0]}${extension}`
          : baseFilename,
        content: preamble + currentFileContent.join('\n')
      });
    }
    
    // If we have multiple files, create an index file that imports and exports everything
    if (files.length > 1) {
      const indexImports = files.map((file, i) => {
        const name = path.basename(file.filename, extension);
        return `import * as ${name.replace(/[^a-zA-Z0-9_]/g, '_')} from './${name}';`;
      }).join('\n');
      
      const indexExports = files.map((file, i) => {
        const name = path.basename(file.filename, extension);
        return `export * from './${name}';`;
      }).join('\n');
      
      files.unshift({
        filename: `${baseName}.index${extension}`,
        content: `${indexImports}\n\n${indexExports}`
      });
    }
    
    return files;
  }
  
  /**
   * Split Python code into multiple files
   */
  private static splitPythonCode(
    lines: string[],
    baseFilename: string,
    maxLines: number
  ): Array<{filename: string, content: string}> {
    const files: Array<{filename: string, content: string}> = [];
    const extension = path.extname(baseFilename);
    const baseName = path.basename(baseFilename, extension);
    
    // Identify imports to include in all files
    const imports: string[] = [];
    let codeStartIndex = 0;
    
    // Find all imports and module documentation
    let inDocstring = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for docstring boundaries
      if (line.includes('"""') || line.includes("'''")) {
        inDocstring = !inDocstring;
        if (!inDocstring && i > 0) {
          codeStartIndex = i + 1;
        }
        continue;
      }
      
      if (!inDocstring && (line.startsWith('import ') || line.startsWith('from '))) {
        imports.push(lines[i]);
        codeStartIndex = i + 1;
      } else if (!inDocstring && line !== '' && !line.startsWith('#')) {
        // First non-empty, non-comment, non-import line
        break;
      }
    }
    
    // Add preamble (imports, etc.)
    const preamble = imports.join('\n') + (imports.length > 0 ? '\n\n' : '');
    
    // Find class and function declarations to split on
    const codeSegments: {start: number, end: number, name: string}[] = [];
    let currentSegmentStart = codeStartIndex;
    let currentSegmentName = "main";
    let indentLevel = 0;
    
    for (let i = codeStartIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Calculate the indent level of this line
      const currentIndent = line.length - line.trimStart().length;
      indentLevel = currentIndent;
      
      // Look for function or class declarations at the top level (no indent)
      if (currentIndent === 0) {
        // If this is a new top-level declaration and we had a previous segment, end it
        if (i > currentSegmentStart && (trimmedLine.startsWith('def ') || trimmedLine.startsWith('class '))) {
          codeSegments.push({
            start: currentSegmentStart,
            end: i - 1,
            name: currentSegmentName
          });
          
          currentSegmentStart = i;
          
          // Extract the name of the new function or class
          const funcMatch = trimmedLine.match(/def\s+(\w+)/);
          const classMatch = trimmedLine.match(/class\s+(\w+)/);
          
          if (funcMatch) {
            currentSegmentName = funcMatch[1];
          } else if (classMatch) {
            currentSegmentName = classMatch[1];
          } else {
            currentSegmentName = "segment" + codeSegments.length;
          }
        }
      }
    }
    
    // Add the final segment
    if (currentSegmentStart < lines.length) {
      codeSegments.push({
        start: currentSegmentStart,
        end: lines.length - 1,
        name: currentSegmentName
      });
    }
    
    // Now create files from the segments
    if (codeSegments.length === 0) {
      // If no segments were found, return the whole file
      files.push({
        filename: baseFilename,
        content: lines.join('\n')
      });
      return files;
    }
    
    let currentFileContent: string[] = [];
    let currentFileSegments: string[] = [];
    
    for (const segment of codeSegments) {
      const segmentLines = lines.slice(segment.start, segment.end + 1);
      
      // If adding this segment would exceed the line limit, create a new file
      if (currentFileContent.length + segmentLines.length > maxLines && currentFileContent.length > 0) {
        // Create a file from accumulated segments
        files.push({
          filename: `${baseName}_${currentFileSegments.join('_')}${extension}`,
          content: preamble + currentFileContent.join('\n')
        });
        
        // Reset for next file
        currentFileContent = [];
        currentFileSegments = [];
      }
      
      // Add this segment to the current file
      currentFileContent.push(...segmentLines);
      currentFileSegments.push(segment.name);
    }
    
    // Add the last file if there's any content left
    if (currentFileContent.length > 0) {
      files.push({
        filename: currentFileSegments.length === 1 && codeSegments.length > 1
          ? `${baseName}_${currentFileSegments[0]}${extension}`
          : baseFilename,
        content: preamble + currentFileContent.join('\n')
      });
    }
    
    // If we have multiple files, create an __init__.py file that imports everything
    if (files.length > 1) {
      const imports = files.map((file) => {
        const moduleName = path.basename(file.filename, extension);
        return `from .${moduleName} import *`;
      }).join('\n');
      
      files.unshift({
        filename: `__init__${extension}`,
        content: imports
      });
    }
    
    return files;
  }
  
  /**
   * Split Java/C# style code into multiple files
   */
  private static splitJavaStyleCode(
    lines: string[],
    baseFilename: string,
    maxLines: number
  ): Array<{filename: string, content: string}> {
    const files: Array<{filename: string, content: string}> = [];
    const extension = path.extname(baseFilename);
    const baseName = path.basename(baseFilename, extension);
    
    // Find package/namespace declarations and imports
    const imports: string[] = [];
    let packageLine = '';
    let codeStartIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('package ') || line.startsWith('namespace ')) {
        packageLine = lines[i];
        codeStartIndex = i + 1;
      } else if (line.startsWith('import ') || line.startsWith('using ')) {
        imports.push(lines[i]);
        codeStartIndex = i + 1;
      } else if (line !== '' && !line.startsWith('//') && !line.startsWith('/*')) {
        // First non-empty, non-comment, non-import line
        break;
      }
    }
    
    // Add preamble (package, imports, etc.)
    let preamble = packageLine ? packageLine + '\n\n' : '';
    preamble += imports.join('\n') + (imports.length > 0 ? '\n\n' : '');
    
    // In Java/C#, each class should be in its own file
    // Find all class declarations
    const classSegments: {start: number, end: number, name: string}[] = [];
    let currentClassStart = -1;
    let currentClassName = '';
    let bracketStack = 0;
    let inComment = false;
    
    for (let i = codeStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments
      if (line.startsWith('//')) continue;
      
      // Check for start/end of multi-line comments
      if (line.includes('/*')) inComment = true;
      if (line.includes('*/')) inComment = false;
      if (inComment) continue;
      
      // Count brackets to determine when a class definition ends
      bracketStack += (line.match(/{/g) || []).length;
      bracketStack -= (line.match(/}/g) || []).length;
      
      // Look for class declarations
      const classMatch = line.match(/(?:public|private|protected)?\s*(?:static)?\s*class\s+(\w+)/);
      if (classMatch && bracketStack === 0) {
        currentClassStart = i;
        currentClassName = classMatch[1];
      }
      
      // When bracket count returns to 0 after a class was started, we've reached the end of the class
      if (currentClassStart !== -1 && bracketStack === 0 && i > currentClassStart) {
        classSegments.push({
          start: currentClassStart,
          end: i,
          name: currentClassName
        });
        
        currentClassStart = -1;
      }
    }
    
    // If there are no class segments or only one that's small enough, just return the whole file
    if (classSegments.length === 0 || (classSegments.length === 1 && lines.length <= maxLines)) {
      files.push({
        filename: baseFilename,
        content: lines.join('\n')
      });
      return files;
    }
    
    // Create a file for each class
    for (const segment of classSegments) {
      const classLines = lines.slice(segment.start, segment.end + 1);
      
      // If this class is too big, split it further (for methods, etc.)
      if (classLines.length > maxLines) {
        // For now, just include a warning comment that the class is too large
        const warningComment = 
          `// WARNING: This class exceeds the recommended line limit of ${maxLines} lines.\n` +
          `// Consider refactoring this class to break it into smaller classes.\n`;
          
        files.push({
          filename: `${segment.name}${extension}`,
          content: preamble + warningComment + classLines.join('\n')
        });
      } else {
        files.push({
          filename: `${segment.name}${extension}`,
          content: preamble + classLines.join('\n')
        });
      }
    }
    
    return files;
  }
  
  /**
   * Simple line-based split for unknown languages
   */
  private static simpleLineSplit(
    lines: string[],
    language: string,
    baseFilename: string,
    maxLines: number
  ): Array<{filename: string, content: string}> {
    const files: Array<{filename: string, content: string}> = [];
    const extension = path.extname(baseFilename);
    const baseName = path.basename(baseFilename, extension);
    
    // If the file is small enough, just return it as is
    if (lines.length <= maxLines) {
      return [{
        filename: baseFilename,
        content: lines.join('\n')
      }];
    }
    
    // Split into chunks
    const numChunks = Math.ceil(lines.length / maxLines);
    for (let i = 0; i < numChunks; i++) {
      const start = i * maxLines;
      const end = Math.min(start + maxLines, lines.length);
      const chunkLines = lines.slice(start, end);
      
      files.push({
        filename: `${baseName}.part${i + 1}${extension}`,
        content: chunkLines.join('\n')
      });
    }
    
    return files;
  }
}