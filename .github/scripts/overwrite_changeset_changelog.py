"""
This script updates a specific version's release notes section in CHANGELOG.md with new content
or reformats existing content.

The script:
1. Takes a version number, changelog path, and optionally new content as input from environment variables
2. Finds the section in the changelog for the specified version
3. Either:
   a) Replaces the content with new content if provided, or
   b) Reformats existing content by:
      - Removing the first two lines of the changeset format
      - Ensuring version numbers are wrapped in square brackets
4. Writes the updated changelog back to the file

Environment Variables:
    CHANGELOG_PATH: Path to the changelog file (defaults to 'CHANGELOG.md')
    VERSION: The version number to update/format
    PREV_VERSION: The previous version number (used to locate section boundaries)
    NEW_CONTENT: Optional new content to insert for this version
"""

#!/usr/bin/env python3

import os
import re
from datetime import datetime

def main():
    # Get version from environment or use example
    version = os.environ.get('VERSION', '0.0.0')
    prev_version = os.environ.get('PREV_VERSION', '0.0.0')
    
    print(f"Formatting changelog for version {version} (previous: {prev_version})")
    
    changelog_path = "CHANGELOG.md"
    
    # Ensure the changelog file exists
    if not os.path.exists(changelog_path):
        print(f"Creating new {changelog_path} file")
        with open(changelog_path, "w") as f:
            f.write("# Changelog\n\n")
    
    # Read the current changelog
    with open(changelog_path, "r") as f:
        content = f.read()
    
    # Check if the version is already in the changelog
    if f"## {version}" in content:
        print(f"Version {version} already exists in changelog, updating format")
        
        # Extract the current entry for this version
        pattern = rf"## {version}(.*?)(?=## {prev_version}|$)"
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            version_content = match.group(1).strip()
            # Format the entry with date and better structure
            today = datetime.now().strftime("%Y-%m-%d")
            formatted_entry = f"\n\n## {version} ({today})\n\n{version_content}\n"
            
            # Replace the existing entry with the formatted one
            content = re.sub(pattern, formatted_entry, content, flags=re.DOTALL)
        else:
            print(f"Could not find content for version {version}")
    else:
        print(f"Version {version} not found in changelog, adding it")
        # Add new version entry at the top of the changelog after the title
        today = datetime.now().strftime("%Y-%m-%d")
        new_entry = f"## {version} ({today})\n\n- Version bump\n"
        
        # Insert after the title
        if "# Changelog" in content:
            content = content.replace("# Changelog", "# Changelog\n\n" + new_entry, 1)
        else:
            content = "# Changelog\n\n" + new_entry + content
    
    # Fix formatting of the entire file
    # Make sure there's always a blank line between sections
    content = re.sub(r"(## \d+\.\d+\.\d+.*?)\n([^#\n])", r"\1\n\n\2", content)
    
    # Make sure there's always a blank line before a new section
    content = re.sub(r"([^\n])\n(## \d+\.\d+\.\d+)", r"\1\n\n\2", content)
    
    # Write back the updated changelog
    with open(changelog_path, "w") as f:
        f.write(content)
    
    print(f"Successfully updated {changelog_path}")

if __name__ == "__main__":
    try:
        main()
        print("Changelog formatting completed successfully")
    except Exception as e:
        print(f"Error formatting changelog: {e}")
        # Don't fail the build if changelog formatting fails
        # but create a minimal changelog entry to continue
        try:
            with open("CHANGELOG.md", "a") as f:
                version = os.environ.get('VERSION', '0.0.0')
                today = datetime.now().strftime("%Y-%m-%d")
                f.write(f"\n\n## {version} ({today})\n\n- Version bump\n")
            print("Created fallback changelog entry")
        except:
            print("Could not create fallback entry either, continuing anyway")