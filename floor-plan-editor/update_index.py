# -*- coding: utf-8 -*-
import os

html_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

start_str = '<!-- 1. МОДАЛЬНОЕ ОКНО: ПАМЯТКА / ИНСТРУКЦИЯ ПО СЪЕМКЕ ПАНОРАМЫ  -->'
end_str = '<!-- 3. МОДАЛЬНОЕ ОКНО: ИНТЕРАКТИВНЫЙ 360° ПРОСМОТРЩИК ПАНОРАМЫ  -->'

idx1 = html.find(start_str)
idx2 = html.find(end_str)

if idx1 == -1 or idx2 == -1:
    print("Markers not found:", idx1, idx2)
    exit(1)

# Find start of comment block before start_str
block_start = html.rfind('<!-- ===', 0, idx1)
block_end = html.rfind('<!-- ===', 0, idx2)

new_content = """<!-- 1. МОДАЛЬНОЕ ОКНО: ПАМЯТКА ПО СЪЕМКЕ В PANORAMA 360          -->
  <!-- ============================================================ -->
  <div id="modal-pano-help" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] hidden flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[92vh]">
      <div class="px-5 py-3.5 border-b border-slate-700 flex items-center justify-between bg-slate-800/90">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/40">
            <i class="fa-solid fa-mobile-screen-button"></i>
          </div>
          <div>
            <h3 class="font-bold text-sm text-white">Панорамы из приложения Panorama 360</h3>
            <p class="text-[11px] text-slate-400">Как создать и добавить круговую панораму на план</p>
          </div>
        </div>
        <button id="btn-close-pano-help" class="text-slate-400 hover:text-white transition p-1">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div class="p-5 space-y-3 overflow-y-auto text-xs text-slate-300">
        <div class="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <div>
            <div class="font-bold text-indigo-300 text-[13px] mb-0.5">Съемка на смартфоне</div>
            <p class="text-slate-300 leading-relaxed">
              Откройте на телефоне приложение <b>Panorama 360 & Virtual Tours</b>. Встаньте в нужной точке комнаты и сделайте полный круговой 360° снимок помещения по экранным меткам.
            </p>
          </div>
        </div>

        <div class="p-3 bg-slate-950/60 border border-slate-700/70 rounded-xl flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <div>
            <div class="font-bold text-white text-[13px] mb-0.5">Сохранение фото (.jpg)</div>
            <p class="text-slate-300 leading-relaxed">
              Сохраните готовую панораму в галерею телефона. Передайте файл на компьютер (через Telegram, USB-кабель, диск или почту).
            </p>
          </div>
        </div>

        <div class="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <div>
            <div class="font-bold text-emerald-300 text-[13px] mb-0.5">Привязка к точке на плане</div>
            <p class="text-slate-300 leading-relaxed">
              Выберите инструмент <b>Панорама 360°</b> на панели инструментов и кликните в комнате (или просто <b>перетащите файл фото прямо на план</b>).
            </p>
          </div>
        </div>

        <div class="p-3 bg-slate-950/60 border border-slate-700/70 rounded-xl flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg bg-cyan-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs">
            4
          </div>
          <div>
            <div class="font-bold text-cyan-300 text-[13px] mb-0.5">Интерактивный просмотр в приложении</div>
            <p class="text-slate-300 leading-relaxed">
              Нажмите на созданную точку на плане — откроется 3D-просмотрщик, где можно вращаться на 360°, приближать детали и совершать виртуальный тур!
            </p>
          </div>
        </div>
      </div>

      <div class="px-5 py-3 border-t border-slate-700 bg-slate-800/80 flex justify-end">
        <button id="btn-confirm-pano-help" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition shadow shadow-indigo-600/30">
          Понятно, закрыть
        </button>
      </div>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- 2. МОДАЛЬНОЕ ОКНО: ТОЧКА ПАНОРАМЫ (ЗАГРУЗКА И ПРИВЯЗКА ФОТО)  -->
  <!-- ============================================================ -->
  <div id="modal-pano-edit" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 hidden flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
      
      <!-- Заголовок -->
      <div class="px-5 py-3.5 border-b border-slate-700 flex items-center justify-between bg-slate-800/90">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
            <i class="fa-solid fa-street-view text-base"></i>
          </div>
          <div>
            <h3 id="modal-pano-edit-title" class="font-bold text-sm text-white">Точка панорамы 360°</h3>
            <p class="text-[11px] text-slate-400">Привязка сферического фото из Panorama 360 & Virtual Tours</p>
          </div>
        </div>
        <button id="btn-close-pano-edit" type="button" class="text-slate-400 hover:text-white transition p-1">
          <i class="fa-solid fa-xmark text-base"></i>
        </button>
      </div>

      <!-- Форма -->
      <form id="form-edit-pano" class="p-5 space-y-4">
        
        <!-- Загрузка фото (Drag & Drop + Input) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <i class="fa-solid fa-image text-indigo-400"></i>
              <span>360° Панорамный снимок (JPG / PNG):</span>
            </label>
            <span id="pano-file-info-badge" class="text-[10px] text-slate-400 font-mono"></span>
          </div>

          <input type="file" id="input-pano-file" accept="image/*" class="hidden">

          <!-- Dropzone при отсутствии файла -->
          <div id="pano-dropzone" class="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-950/20 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group bg-slate-950/60">
            <div class="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition border border-indigo-500/30">
              <i class="fa-solid fa-cloud-arrow-up text-xl"></i>
            </div>
            <div>
              <p class="text-xs font-semibold text-white group-hover:text-indigo-300 transition">
                Перетащите 360° фото сюда или <span class="text-indigo-400 underline">выберите файл</span>
              </p>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Экспортируйте фото из приложения Panorama 360 & Virtual Tours
              </p>
            </div>
          </div>

          <!-- Превью загруженного файла -->
          <div id="pano-preview-container" class="hidden space-y-2">
            <div class="relative rounded-xl overflow-hidden border border-slate-700 bg-black group h-36 flex items-center justify-center shadow-inner">
              <img id="pano-preview-img" src="" alt="360 Panorama Preview" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button type="button" id="btn-preview-in-viewer" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition">
                  <i class="fa-solid fa-eye"></i>
                  <span>Посмотреть 360°</span>
                </button>
                <button type="button" id="btn-change-pano-file" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-600 shadow-lg transition">
                  <i class="fa-solid fa-arrow-rotate-right"></i>
                  <span>Заменить фото</span>
                </button>
              </div>
              <div class="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] text-emerald-400 font-mono border border-emerald-500/30 flex items-center gap-1" id="pano-resolution-tag">
                <i class="fa-solid fa-check text-[9px]"></i> 360° Фото готово
              </div>
            </div>
          </div>
        </div>

        <!-- Параметры: название и комната -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <i class="fa-solid fa-tag text-indigo-400"></i>
              <span>Название точки:</span>
            </label>
            <input type="text" id="input-edit-pano-name" placeholder="Например: Гостиная" class="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <i class="fa-solid fa-vector-square text-cyan-400"></i>
              <span>Привязанная комната:</span>
            </label>
            <select id="select-edit-pano-room" class="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono">
              <!-- Комнаты текущего этажа -->
            </select>
          </div>
        </div>

        <!-- Координаты -->
        <div class="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <span class="text-slate-400 flex items-center gap-1.5">
            <i class="fa-solid fa-crosshairs text-indigo-400"></i>
            <span>Координаты на плане:</span>
          </span>
          <span id="label-edit-pano-coords" class="font-mono text-indigo-300 font-bold">X: 0, Y: 0</span>
        </div>

        <!-- Кнопки управления -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-800">
          <button type="button" id="btn-delete-current-pano" class="px-3 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition hidden">
            <i class="fa-solid fa-trash"></i>
            <span>Удалить точку</span>
          </button>
          
          <div class="flex items-center gap-2 ml-auto">
            <button type="button" id="btn-cancel-pano-edit" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition">
              Отмена
            </button>
            <button type="submit" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition">
              <i class="fa-solid fa-check"></i>
              <span>Сохранить точку</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>

  """

html = html[:block_start] + '<!-- ============================================================ -->\n  ' + new_content + html[block_end:]

# Also update viewer buttons (add edit and fullscreen button)
old_viewer_btns = '<button id="btn-viewer-download"'
new_viewer_btns = '''<button id="btn-viewer-edit-point" class="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition border border-indigo-500/40" title="Заменить фото или изменить параметры точки">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Заменить фото</span>
          </button>
          <button id="btn-viewer-fullscreen" class="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1 transition border border-slate-600" title="На весь экран">
            <i class="fa-solid fa-expand" id="icon-viewer-fullscreen"></i>
          </button>
          <button id="btn-viewer-download"'''

if old_viewer_btns in html:
    html = html.replace(old_viewer_btns, new_viewer_btns)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("SUCCESS: index.html updated!")
