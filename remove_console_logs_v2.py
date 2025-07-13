#!/usr/bin/env python3
"""
Script to comment out all console.log/error/warn/info statements in TypeScript/JavaScript files.
Handles multi-line statements and template literals properly.
"""

import re
import os
import sys
from pathlib import Path

def comment_out_console_statements(file_path):
    """Comment out console statements in a file, handling multi-line cases."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    modified = False
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()
        indent = line[:len(line) - len(stripped)]
        
        # Check if this line starts with console.* (and not already commented)
        if (stripped.startswith('console.') and 
            not stripped.startswith('// console.') and
            any(stripped.startswith(f'console.{method}') for method in ['log', 'error', 'warn', 'info'])):
            
            # Comment out this line
            lines[i] = indent + '// ' + stripped
            modified = True
            
            # For multi-line console statements (especially template literals)
            # we need to check if the statement continues on next lines
            if '`' in stripped and stripped.count('`') % 2 == 1:
                # Unclosed template literal - find the closing backtick
                i += 1
                while i < len(lines):
                    # These lines are part of the template literal, leave them as-is
                    if '`' in lines[i]:
                        # Found closing backtick
                        break
                    i += 1
            elif not stripped.rstrip().endswith(';') and not stripped.rstrip().endswith(')'):
                # Statement might continue on next line
                open_parens = stripped.count('(') - stripped.count(')')
                if open_parens > 0:
                    # Find the closing parenthesis
                    i += 1
                    while i < len(lines) and open_parens > 0:
                        open_parens += lines[i].count('(') - lines[i].count(')')
                        i += 1
                    i -= 1  # Back up one since we'll increment at the end
        
        i += 1
    
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return True
    return False

def count_active_console_statements(file_path):
    """Count non-commented console statements."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Match console statements that aren't commented
    pattern = r'^(?!.*//.*console\.(?:log|error|warn|info)).*console\.(?:log|error|warn|info)'
    matches = re.findall(pattern, content, re.MULTILINE)
    return len(matches)

def main():
    """Main function to process TypeScript/JavaScript files in src directory."""
    src_dir = Path(__file__).parent / 'src'
    
    if not src_dir.exists():
        print(f"Error: src directory not found at {src_dir}")
        sys.exit(1)
    
    # Files to process (excluding some that might be OK to have console in)
    files_to_process = [
        'index.ts',
        'content-extractor.ts', 
        'agent-page-generator.ts',
        'browser-agent-generator.ts',
        'devtools-elements.ts',
        'wait-state-manager.ts',
        'agent-page-script.ts',  # This runs in browser context but better to be safe
        'html-parser.ts',
        'debugging-tools.ts',
        'network-tools.ts',
        'dom-monitor.ts',
        'devtools.ts',
        'page-analysis.ts',
        'form-tools.ts',
        'form-detector.ts',
        'human-interaction.ts',
        'storage-tools.ts'
    ]
    
    print("Commenting out console statements in MCP server files...\n")
    
    total_files_modified = 0
    
    for file_name in files_to_process:
        file_path = src_dir / file_name
        if file_path.exists():
            before_count = count_active_console_statements(file_path)
            if before_count > 0:
                if comment_out_console_statements(file_path):
                    after_count = count_active_console_statements(file_path)
                    print(f"✓ {file_path.name}: Commented {before_count - after_count} console statements")
                    total_files_modified += 1
                else:
                    print(f"  {file_path.name}: No changes made")
            else:
                print(f"  {file_path.name}: No active console statements found")
        else:
            print(f"⚠ {file_path.name}: File not found")
    
    print(f"\n✅ Modified {total_files_modified} files")
    
    # Note about cli.ts
    print("\nNote: cli.ts was skipped as it runs in CLI mode, not MCP server mode")

if __name__ == '__main__':
    main()