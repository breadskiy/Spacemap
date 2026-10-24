# -*- coding: utf-8 -*-
import re

html_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\index.html'
app_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\app.js'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

matches = re.findall(r"document\.getElementById\(['\"]([^'\"]+)['\"]\)", code)

missing = []
for el_id in set(matches):
    if f'id="{el_id}"' not in html and f"id='{el_id}'" not in html:
        missing.append(el_id)

print('Missing element IDs in index.html:', missing)

# Check lines where missing IDs are used
for el_id in missing:
    for line_num, line in enumerate(code.splitlines(), start=1):
        if el_id in line:
            print(f'Line {line_num} mentions missing {el_id}: {line.strip()[:100]}')
