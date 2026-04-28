import os

path = r'd:\ZeroIsle_Notes\backend\knowledge_graph\services\recommendation_service.py'
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Check line 520 (index 519)
    # The traceback says line 520: """
    # If it is unclosed, we might need to add """ or remove it.
    
    # Let's inspect line 520
    if len(lines) >= 520:
        print(f"Line 520 content: {lines[519]}")
        # If it's a docstring start that was left open, we close it.
        # But if it's at end of file, maybe it was a mistake.
        # I'll replace it with a valid closed string or remove it.
        if lines[519].strip() == '"""':
             lines[519] = '    """End of file fix"""\n'
             print("Fixed line 520")
        elif '"""' in lines[519]:
             # If it has """ but no end, append end.
             if lines[519].strip().endswith('"""') and lines[519].strip().startswith('"""'):
                 pass # looks closed?
             else:
                 # It's likely opening.
                 lines[519] = lines[519].rstrip() + '"""\n'
                 print("Appended closing quotes to line 520")

    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
        
except Exception as e:
    print(f"Error: {e}")
