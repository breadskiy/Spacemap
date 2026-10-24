# -*- coding: utf-8 -*-
with open(r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's check functions called but not defined
import re

func_calls = re.findall(r'([a-zA-Z0-9_$]+)\s*\(', code)
func_defs = set(re.findall(r'function\s+([a-zA-Z0-9_$]+)', code))
const_funcs = set(re.findall(r'(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>)', code))

all_defs = func_defs.union(const_funcs)

# standard js globals
standard_globals = {
    'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
    'cancelAnimationFrame', 'fetch', 'Math', 'JSON', 'Date', 'Image', 'FileReader',
    'Blob', 'URL', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error',
    'document', 'window', 'console', 'navigator', 'localStorage', 'sessionStorage',
    'encodeURIComponent', 'decodeURIComponent'
}

print('Total function calls:', len(func_calls))
undefined_calls = set()
for f_name in set(func_calls):
    if f_name not in all_defs and f_name not in standard_globals:
        # Check if it's a method call like Math.round or e.preventDefault or ctx.beginPath
        # In our regex, if it was preceded by a dot, it was a method call
        pass

# Check specifically top-level calls at startup:
for line in code.splitlines()[-25:]:
    print('Startup line:', line)
