# -*- coding: utf-8 -*-
app_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\app.js'

with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Helper storage functions
storage_code = '''
// -------------------------------------------------------------
// АВТОСОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ ЧЕРНОВИКА (LOCALSTORAGE)
// -------------------------------------------------------------
function saveDraftToStorage() {
  try {
    localStorage.setItem('ttk_floor_plan_draft', exportToJSON());
  } catch (err) {
    // Игнорируем квоту LocalStorage
  }
}

function loadDraftFromStorage() {
  try {
    const saved = localStorage.getItem('ttk_floor_plan_draft');
    if (saved) {
      const data = JSON.parse(saved);
      if (data && Array.isArray(data.floors) && data.floors.length > 0) {
        const hasContent = data.floors.some(f => 
          (f.corners && f.corners.length > 0) || 
          (f.walls && f.walls.length > 0) || 
          (f.rooms && f.rooms.length > 0) || 
          (f.panoramas && f.panoramas.length > 0)
        );
        if (hasContent) {
          loadJSONData(data);
          console.log('[Editor] Черновик успешно восстановлен из LocalStorage!');
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[Editor] Ошибка чтения LocalStorage:', err);
  }
  return false;
}
'''

# Check if saveDraftToStorage is missing and add it right before startup
if 'function saveDraftToStorage' not in code:
    startup_marker = "resizeCanvas();"
    # Find last occurrence of resizeCanvas();
    last_idx = code.rfind(startup_marker)
    if last_idx != -1:
        code = code[:last_idx] + storage_code + '\n// Старт приложения\n' + code[last_idx:]
        print('Added storage_code before startup!')

# Update startup logic to fallback to sample-plan.json if storage is empty
old_startup = '''// Старт приложения
resizeCanvas();
if (!loadDraftFromStorage()) {
  updateFloorUI();
}
setTool('corner');
render();'''

new_startup = '''// Старт приложения
resizeCanvas();
if (!loadDraftFromStorage()) {
  fetch('sample-plan.json')
    .then(r => r.json())
    .then(data => {
      loadJSONData(data);
      console.log('[Editor] Загружен готовый план помещения!');
    })
    .catch(() => {
      updateFloorUI();
      render();
    });
}
setTool('corner');
render();'''

if old_startup in code:
    code = code.replace(old_startup, new_startup)
    print('Updated startup sequence!')

# Also update resizeCanvas to be resilient and crisp
old_resize = '''function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}
window.addEventListener('resize', resizeCanvas);'''

new_resize = '''function resizeCanvas() {
  if (container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  render();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', resizeCanvas);
window.addEventListener('load', resizeCanvas);'''

if old_resize in code:
    code = code.replace(old_resize, new_resize)
    print('Updated resizeCanvas!')

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(code)

print('SUCCESS: app.js fixed!')
