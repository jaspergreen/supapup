#!/usr/bin/env python3
"""
Script to comment out all console.log/error/warn/info statements in TypeScript/JavaScript files.
This prevents console output from interfering with MCP protocol communication.
"""

import re
import os
import sys
from pathlib import Path

def comment_out_console_statements(file_path):
    """Comment out console statements in a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern to match console statements that aren't already commented
    # This regex looks for console.log/error/warn/info that aren't preceded by //
    # and handles multi-line statements
    patterns = [
        # Single line console statements not already commented
        (r'^(\s*)(?<!\/\/)console\.(log|error|warn|info)\s*\(', r'\1// console.\2('),
        # Multi-line console statements (where console is at start of line)
        (r'^(\s*)(?<!\/\/)console\.(log|error|warn|info)\s*\(\s*\n', r'\1// console.\2(\n'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    # Count changes
    changes = len([1 for a, b in zip(original_content.splitlines(), content.splitlines()) if a != b])
    
    if changes > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ {file_path}: Commented out {changes} lines")
    else:
        print(f"  {file_path}: No changes needed")
    
    return changes

def main():
    """Main function to process all TypeScript/JavaScript files in src directory."""
    src_dir = Path(__file__).parent / 'src'
    
    if not src_dir.exists():
        print(f"Error: src directory not found at {src_dir}")
        sys.exit(1)
    
    # Files to process (based on grep results)
    files_to_process = [
        'index.ts',
        'content-extractor.ts',
        'agent-page-generator.ts',
        'browser-agent-generator.ts',
        'devtools-elements.ts',
        'wait-state-manager.ts',
        'agent-page-script.ts',
        'html-parser.ts',
        'cli.ts'
    ]
    
    total_changes = 0
    
    print("Commenting out console statements in source files...\n")
    
    for file_name in files_to_process:
        file_path = src_dir / file_name
        if file_path.exists():
            changes = comment_out_console_statements(file_path)
            total_changes += changes
        else:
            print(f"⚠ {file_path}: File not found")
    
    print(f"\n✅ Total lines modified: {total_changes}")
    
    # Optionally process all .ts and .js files
    if '--all' in sys.argv:
        print("\nProcessing all TypeScript/JavaScript files...")
        for ext in ['*.ts', '*.js']:
            for file_path in src_dir.rglob(ext):
                if file_path.name not in files_to_process:
                    changes = comment_out_console_statements(file_path)
                    total_changes += changes
        print(f"\n✅ Grand total lines modified: {total_changes}")

if __name__ == '__main__':
    main()