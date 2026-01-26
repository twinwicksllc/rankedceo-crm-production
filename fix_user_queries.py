import os
import re

# Find all .tsx files in app/(dashboard)
dashboard_dir = "app/(dashboard)"
files_to_fix = []

for root, dirs, files in os.walk(dashboard_dir):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            files_to_fix.append(filepath)

# Fix each file
for filepath in files_to_fix:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace .eq('id', user.id) with .eq('email', user.email)
    # Only for queries to the 'users' table
    original = content
    
    # Pattern: .from('users').select(...).eq('id', user.id)
    content = re.sub(
        r"(\.from\('users'\)\.select\([^)]+\))\.eq\('id', user\.id\)",
        r"\1.eq('email', user.email)",
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
    else:
        print(f"No changes: {filepath}")

print("\nDone!")