# -*- coding: utf-8 -*-
html_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add #btn-viewer-toggle-pois in modal-pano-viewer header
old_hdr_btn = '<button id="btn-viewer-edit-point"'
new_hdr_btn = '''<button id="btn-viewer-toggle-pois" class="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition border border-rose-500/40 shadow" title="Скрыть или показать точки интереса на панораме">
            <i class="fa-solid fa-location-dot text-rose-400" id="icon-toggle-pois"></i>
            <span id="label-toggle-pois">Скрыть точки</span>
          </button>
          <button id="btn-viewer-edit-point"'''

if old_hdr_btn in html and 'btn-viewer-toggle-pois' not in html:
    html = html.replace(old_hdr_btn, new_hdr_btn, 1)
    print("Added btn-viewer-toggle-pois to viewer header!")

# 2. Add Hotspots section in modal-pano-edit right before coordinates or footer
coords_block = '''        <!-- Координаты -->
        <div class="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <span class="text-slate-400 flex items-center gap-1.5">
            <i class="fa-solid fa-crosshairs text-indigo-400"></i>
            <span>Координаты на плане:</span>
          </span>
          <span id="label-edit-pano-coords" class="font-mono text-indigo-300 font-bold">X: 0, Y: 0</span>
        </div>'''

hotspots_section = '''        <!-- Секция: Точки интереса (Hotspots) на 360° панораме -->
        <div class="space-y-2 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <i class="fa-solid fa-location-dot text-rose-400"></i>
              <span>Точки интереса (POI) в панораме:</span>
              <span id="pano-hs-count-badge" class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">0</span>
            </span>
            <div class="flex items-center gap-1.5">
              <button type="button" id="btn-pano-import-room-pois" class="px-2 py-1 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 transition" title="Автоматически добавить точки интереса из этой комнаты по их координатам на плане">
                <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                <span>Импорт из комнаты</span>
              </button>
              <button type="button" id="btn-pano-add-hotspot" class="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 transition" title="Добавить новую точку интереса вручную">
                <i class="fa-solid fa-plus text-[10px]"></i>
                <span>Добавить POI</span>
              </button>
            </div>
          </div>

          <!-- Список добавленных точек интереса -->
          <div id="pano-hotspots-list" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            <!-- Элементы генерируются из JS -->
          </div>

          <!-- Форма добавления точки (скрыта по умолчанию) -->
          <div id="pano-add-hotspot-form" class="hidden p-2.5 bg-slate-900 rounded-lg border border-slate-700/80 space-y-2 text-xs">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-slate-400 block mb-0.5">Название точки:</label>
                <input type="text" id="input-new-hs-title" placeholder="Стойка регистрации" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-rose-500">
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-0.5">Категория:</label>
                <select id="select-new-hs-category" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-rose-500 font-mono">
                  <option value="stand">Выставочный стенд</option>
                  <option value="info">Инфо / Ресепшн</option>
                  <option value="food">Кофе / Еда / Напитки</option>
                  <option value="wifi">Точка Wi-Fi</option>
                  <option value="service">Сервис / Услуга</option>
                  <option value="wc">Санузел</option>
                  <option value="entrance">Вход / Выход</option>
                </select>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div class="flex items-center gap-2 text-[11px] text-slate-300 flex-1">
                <span>Угол:</span>
                <input type="range" id="input-new-hs-yaw" min="0" max="360" value="0" class="flex-1 accent-rose-500 cursor-pointer">
                <span id="label-new-hs-yaw" class="font-mono text-rose-400 font-bold w-9 text-right">0°</span>
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" id="btn-cancel-add-hs" class="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs">
                  Отмена
                </button>
                <button type="button" id="btn-confirm-add-hs" class="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow">
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>'''

if coords_block in html and 'pano-hotspots-list' not in html:
    html = html.replace(coords_block, coords_block + '\n\n' + hotspots_section, 1)
    print("Added Hotspots section to modal-pano-edit!")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("SUCCESS: index.html updated!")
