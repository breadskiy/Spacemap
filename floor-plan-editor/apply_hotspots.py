# -*- coding: utf-8 -*-
import re

app_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\app.js'

with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add POI_CATEGORIES dictionary right before panoEditorState
cat_dict = '''const POI_CATEGORIES = {
  stand: { label: 'Стенд / Экспонат', color: '#f43f5e', icon: 'fa-cube', symbol: '🏬' },
  info: { label: 'Инфо / Ресепшн', color: '#0ea5e9', icon: 'fa-circle-info', symbol: 'ℹ️' },
  food: { label: 'Кофе / Еда / Бар', color: '#f59e0b', icon: 'fa-mug-hot', symbol: '☕' },
  wifi: { label: 'Точка Wi-Fi', color: '#10b981', icon: 'fa-wifi', symbol: '📶' },
  service: { label: 'Сервис / Услуги', color: '#a855f7', icon: 'fa-bell-concierge', symbol: '🛎️' },
  wc: { label: 'Санузел', color: '#06b6d4', icon: 'fa-restroom', symbol: '🚻' },
  entrance: { label: 'Вход / Выход', color: '#10b981', icon: 'fa-door-open', symbol: '🚪' }
};

let panoClickTimeout = null;
'''

if 'const POI_CATEGORIES' not in code:
    code = code.replace('const panoEditorState = {', cat_dict + '\nconst panoEditorState = {')
    print("Added POI_CATEGORIES dictionary!")

# 2. Add hotspots array into panoEditorState
old_state = '''const panoEditorState = {
  panoId: null,
  x: 0,
  y: 0,
  imageData: null,
  fileName: null,
  width: 0,
  height: 0
};'''

new_state = '''const panoEditorState = {
  panoId: null,
  x: 0,
  y: 0,
  imageData: null,
  fileName: null,
  width: 0,
  height: 0,
  hotspots: []
};'''

if old_state in code:
    code = code.replace(old_state, new_state)
    print("Updated panoEditorState with hotspots array!")

# 3. Add Hotspot UI handlers inside pano editor
hotspot_handlers = '''
// Элементы управления точками интереса (Hotspots) панорамы
const panoHotspotsList = document.getElementById('pano-hotspots-list');
const panoHsCountBadge = document.getElementById('pano-hs-count-badge');
const btnPanoImportRoomPois = document.getElementById('btn-pano-import-room-pois');
const btnPanoAddHotspot = document.getElementById('btn-pano-add-hotspot');
const panoAddHotspotForm = document.getElementById('pano-add-hotspot-form');
const inputNewHsTitle = document.getElementById('input-new-hs-title');
const selectNewHsCategory = document.getElementById('select-new-hs-category');
const inputNewHsYaw = document.getElementById('input-new-hs-yaw');
const labelNewHsYaw = document.getElementById('label-new-hs-yaw');
const btnCancelAddHs = document.getElementById('btn-cancel-add-hs');
const btnConfirmAddHs = document.getElementById('btn-confirm-add-hs');

if (inputNewHsYaw) {
  inputNewHsYaw.addEventListener('input', e => {
    if (labelNewHsYaw) labelNewHsYaw.innerText = `${e.target.value}°`;
  });
}

if (btnPanoAddHotspot) {
  btnPanoAddHotspot.addEventListener('click', () => {
    if (panoAddHotspotForm) {
      panoAddHotspotForm.classList.toggle('hidden');
      if (!panoAddHotspotForm.classList.contains('hidden') && inputNewHsTitle) {
        inputNewHsTitle.focus();
      }
    }
  });
}

if (btnCancelAddHs) {
  btnCancelAddHs.addEventListener('click', () => {
    if (panoAddHotspotForm) panoAddHotspotForm.classList.add('hidden');
  });
}

if (btnConfirmAddHs) {
  btnConfirmAddHs.addEventListener('click', () => {
    const title = inputNewHsTitle ? inputNewHsTitle.value.trim() : '';
    if (!title) {
      alert('Введите название точки интереса');
      return;
    }
    const cat = selectNewHsCategory ? selectNewHsCategory.value : 'stand';
    const yaw = inputNewHsYaw ? parseInt(inputNewHsYaw.value) || 0 : 0;

    const newHs = {
      id: genId('hs'),
      name: title,
      category: cat,
      yaw: yaw,
      pitch: 0
    };
    panoEditorState.hotspots.push(newHs);
    renderPanoHotspotsList();
    if (inputNewHsTitle) inputNewHsTitle.value = '';
    if (panoAddHotspotForm) panoAddHotspotForm.classList.add('hidden');
  });
}

// Импорт существующих POI из комнаты или плана с авто-расчетом азимута (yaw)
if (btnPanoImportRoomPois) {
  btnPanoImportRoomPois.addEventListener('click', () => {
    const floor = getCurrentFloor();
    if (!floor || !floor.pois || floor.pois.length === 0) {
      alert('На этом этаже еще нет созданных точек интереса (POI).');
      return;
    }

    const roomId = selectEditPanoRoom ? selectEditPanoRoom.value : null;
    const roomPois = roomId 
      ? floor.pois.filter(p => p.room_id === roomId)
      : floor.pois;

    const targetList = roomPois.length > 0 ? roomPois : floor.pois;
    let addedCount = 0;

    targetList.forEach(poi => {
      // Проверяем, не добавлена ли уже
      const exists = panoEditorState.hotspots.some(h => h.name === poi.name);
      if (!exists) {
        // Расчет азимута направления от точки панорамы к POI
        const dx = poi.x - panoEditorState.x;
        const dy = poi.y - panoEditorState.y; // в Cartesian: +Y вверх (Север = 0°)
        let yaw = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360);

        panoEditorState.hotspots.push({
          id: genId('hs'),
          name: poi.name,
          category: poi.category || 'stand',
          yaw: yaw,
          pitch: 0
        });
        addedCount++;
      }
    });

    renderPanoHotspotsList();
    if (addedCount > 0) {
      updateStatusHint(`Импортировано ${addedCount} точек интереса в панораму!`);
    } else {
      alert('Все точки из этой зоны уже добавлены в список.');
    }
  });
}

function renderPanoHotspotsList() {
  if (!panoHotspotsList) return;
  panoHotspotsList.innerHTML = '';

  const count = panoEditorState.hotspots.length;
  if (panoHsCountBadge) panoHsCountBadge.innerText = count.toString();

  if (count === 0) {
    panoHotspotsList.innerHTML = `
      <div class="text-center py-3 text-[11px] text-slate-500">
        Нет точек в этой панораме. Нажмите «Импорт из комнаты» или «Добавить POI».
      </div>
    `;
    return;
  }

  panoEditorState.hotspots.forEach((hs, idx) => {
    const cat = POI_CATEGORIES[hs.category] || POI_CATEGORIES.stand;
    const row = document.createElement('div');
    row.className = 'p-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs transition hover:border-slate-600';
    row.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${cat.color};"></span>
        <span class="font-semibold text-white truncate text-[11px]">${cat.symbol} ${hs.name}</span>
        <span class="text-[10px] text-slate-400 font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 shrink-0">
          ${hs.yaw}°
        </span>
      </div>
      <button type="button" class="btn-del-hs text-slate-500 hover:text-rose-400 p-1 transition" title="Удалить метку">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    `;

    row.querySelector('.btn-del-hs').addEventListener('click', () => {
      panoEditorState.hotspots.splice(idx, 1);
      renderPanoHotspotsList();
    });

    panoHotspotsList.appendChild(row);
  });
}
'''

# 4. Update openPanoEditModal to initialize hotspots
old_open_modal_start = '''  if (pano) {
    panoEditorState.panoId = pano.id;
    panoEditorState.x = pano.x;
    panoEditorState.y = pano.y;
    panoEditorState.imageData = pano.image_data || null;'''

new_open_modal_start = '''  if (pano) {
    panoEditorState.panoId = pano.id;
    panoEditorState.x = pano.x;
    panoEditorState.y = pano.y;
    panoEditorState.imageData = pano.image_data || null;
    panoEditorState.hotspots = Array.isArray(pano.hotspots) ? JSON.parse(JSON.stringify(pano.hotspots)) : [];'''

if old_open_modal_start in code:
    code = code.replace(old_open_modal_start, new_open_modal_start)
    print("Updated openPanoEditModal for existing pano hotspots!")

old_open_modal_new = '''  } else {
    panoEditorState.panoId = null;
    panoEditorState.x = defX;
    panoEditorState.y = defY;
    panoEditorState.imageData = null;'''

new_open_modal_new = '''  } else {
    panoEditorState.panoId = null;
    panoEditorState.x = defX;
    panoEditorState.y = defY;
    panoEditorState.imageData = null;
    panoEditorState.hotspots = [];'''

if old_open_modal_new in code:
    code = code.replace(old_open_modal_new, new_open_modal_new)
    print("Updated openPanoEditModal for new pano hotspots!")

# Add call to renderPanoHotspotsList inside openPanoEditModal
old_modal_display = '''  modalPanoEdit.style.display = 'flex';
  modalPanoEdit.classList.remove('hidden');
  inputEditPanoName.focus();'''

new_modal_display = '''  renderPanoHotspotsList();
  modalPanoEdit.style.display = 'flex';
  modalPanoEdit.classList.remove('hidden');
  inputEditPanoName.focus();'''

if old_modal_display in code:
    code = code.replace(old_modal_display, new_modal_display)
    print("Added renderPanoHotspotsList call in openPanoEditModal!")

# 5. Update formEditPano submit to save hotspots
old_save_existing = '''      if (existing) {
        existing.name = name;
        existing.room_id = roomId;
        if (panoEditorState.imageData) {
          existing.image_data = panoEditorState.imageData;
        }
        savedPano = existing;
      }'''

new_save_existing = '''      if (existing) {
        existing.name = name;
        existing.room_id = roomId;
        existing.hotspots = panoEditorState.hotspots;
        if (panoEditorState.imageData) {
          existing.image_data = panoEditorState.imageData;
        }
        savedPano = existing;
      }'''

if old_save_existing in code:
    code = code.replace(old_save_existing, new_save_existing)
    print("Updated saving existing pano hotspots!")

old_save_new = '''      const newPano = {
        id: genId('pano'),
        name: name,
        room_id: roomId,
        x: panoEditorState.x,
        y: panoEditorState.y,
        image_data: panoEditorState.imageData || null,
        created_at: new Date().toISOString()
      };'''

new_save_new = '''      const newPano = {
        id: genId('pano'),
        name: name,
        room_id: roomId,
        x: panoEditorState.x,
        y: panoEditorState.y,
        image_data: panoEditorState.imageData || null,
        hotspots: panoEditorState.hotspots,
        created_at: new Date().toISOString()
      };'''

if old_save_new in code:
    code = code.replace(old_save_new, new_save_new)
    print("Updated saving new pano hotspots!")

# 6. Update triggerPreviewInViewer to pass hotspots
old_trigger = '''  const tempPano = {
    id: panoEditorState.panoId || 'temp_preview',
    name: inputEditPanoName.value.trim() || 'Предпросмотр 360°',
    room_id: selectEditPanoRoom.value || null,
    x: panoEditorState.x,
    y: panoEditorState.y,
    image_data: panoEditorState.imageData || null
  };'''

new_trigger = '''  const tempPano = {
    id: panoEditorState.panoId || 'temp_preview',
    name: inputEditPanoName.value.trim() || 'Предпросмотр 360°',
    room_id: selectEditPanoRoom.value || null,
    x: panoEditorState.x,
    y: panoEditorState.y,
    image_data: panoEditorState.imageData || null,
    hotspots: panoEditorState.hotspots
  };'''

if old_trigger in code:
    code = code.replace(old_trigger, new_trigger)
    print("Updated triggerPreviewInViewer to pass hotspots!")

# 7. Add Hotspots rendering & toggle button in 360 viewer
viewer_toggle_code = '''
// Кнопка показа/скрытия точек интереса в 360° вьювере
const btnViewerTogglePois = document.getElementById('btn-viewer-toggle-pois');
const labelTogglePois = document.getElementById('label-toggle-pois');
const iconTogglePois = document.getElementById('icon-toggle-pois');

if (btnViewerTogglePois) {
  btnViewerTogglePois.addEventListener('click', () => {
    viewerState.showHotspots = !viewerState.showHotspots;
    updateViewerPoisToggleBtn();
  });
}

function updateViewerPoisToggleBtn() {
  if (!btnViewerTogglePois || !labelTogglePois || !iconTogglePois) return;
  if (viewerState.showHotspots) {
    labelTogglePois.innerText = 'Скрыть точки';
    iconTogglePois.className = 'fa-solid fa-location-dot text-rose-400';
    btnViewerTogglePois.className = 'px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition border border-rose-500/40 shadow';
  } else {
    labelTogglePois.innerText = 'Показать точки';
    iconTogglePois.className = 'fa-solid fa-location-dot text-slate-400';
    btnViewerTogglePois.className = 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition border border-slate-700 shadow';
  }
}

// Отрисовка интерактивных точек интереса в 360° просмотрщике
function drawViewerHotspots(c, vw, vh, hotspots) {
  if (!hotspots || hotspots.length === 0) return;

  const currentYaw = viewerState.yaw;
  const currentPitch = viewerState.pitch;
  const fov = viewerState.fov;

  hotspots.forEach(hs => {
    let diffYaw = hs.yaw - currentYaw;
    while (diffYaw < -180) diffYaw += 360;
    while (diffYaw > 180) diffYaw -= 360;

    // Проверка видимости в текущем угле обзора
    if (Math.abs(diffYaw) > (fov / 2 + 10)) return;

    // Координаты на экране
    const hx = (vw / 2) + (diffYaw / fov) * vw;
    const diffPitch = (hs.pitch || 0) - currentPitch;
    const pitchOffset = (diffPitch / 45) * (vh * 0.45);
    const hy = (vh / 2) - pitchOffset;

    const cat = POI_CATEGORIES[hs.category] || POI_CATEGORIES.stand;
    const color = cat.color;
    const radius = 9;

    c.save();

    // 1. Внешний мягкий ореол
    c.beginPath();
    c.arc(hx, hy, radius + 4, 0, Math.PI * 2);
    c.fillStyle = 'rgba(244, 63, 94, 0.22)';
    c.fill();

    // 2. Тень
    c.beginPath();
    c.arc(hx, hy + 2, radius + 2, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 0, 0, 0.45)';
    c.fill();

    // 3. Основной круг маркера (как на 2D плане)
    c.beginPath();
    c.arc(hx, hy, radius, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.5;
    c.stroke();

    // 4. Белая точка в центре
    c.beginPath();
    c.arc(hx, hy, radius * 0.4, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();

    // 5. Ножка указателя
    c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(hx, hy - radius);
    c.lineTo(hx, hy - radius - 8);
    c.stroke();

    // 6. Плашка с названием и символом точки
    const titleText = `${cat.symbol} ${hs.name}`;
    c.font = 'bold 12px sans-serif';
    const textW = c.measureText(titleText).width;
    const padX = 10;
    const badgeW = textW + padX * 2;
    const badgeH = 22;
    const bx = hx;
    const by = hy - radius - 8 - (badgeH / 2);

    c.beginPath();
    c.roundRect(bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 6);
    c.fillStyle = 'rgba(15, 23, 42, 0.88)';
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.stroke();

    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(titleText, bx, by);

    c.restore();
  });
}
'''

# Add viewerState.showHotspots = true in viewerState definition
old_vstate = '''const viewerState = {
  pano: null,
  textureImg: null,
  yaw: 0,
  pitch: 0,
  fov: 75,
  autoRotate: true,
  isDragging: false,
  lastX: 0,
  lastY: 0,
  animId: null
};'''

new_vstate = '''const viewerState = {
  pano: null,
  textureImg: null,
  yaw: 0,
  pitch: 0,
  fov: 75,
  autoRotate: true,
  showHotspots: true,
  isDragging: false,
  lastX: 0,
  lastY: 0,
  animId: null
};'''

if old_vstate in code:
    code = code.replace(old_vstate, new_vstate)
    print("Added showHotspots to viewerState!")

# Insert hotspots rendering in render360
render_compass_hook = '// Отрисовка компаса вверху вьювера\n    drawViewerCompass(viewer360Ctx, vw, vh, viewerState.yaw);'
hotspots_render_call = '''// Отрисовка точек интереса на 360° панораме
    if (viewerState.showHotspots && viewerState.pano && Array.isArray(viewerState.pano.hotspots)) {
      drawViewerHotspots(viewer360Ctx, vw, vh, viewerState.pano.hotspots);
    }

    // Отрисовка компаса вверху вьювера
    drawViewerCompass(viewer360Ctx, vw, vh, viewerState.yaw);'''

if render_compass_hook in code and 'drawViewerHotspots' not in code:
    code = code.replace(render_compass_hook, hotspots_render_call)
    print("Added drawViewerHotspots call inside render360!")

# Add hotspot_handlers right before openPanoEditModal
if 'btnPanoAddHotspot' not in code:
    code = code.replace('function openPanoEditModal', hotspot_handlers + '\nfunction openPanoEditModal')
    print("Added hotspot_handlers to app.js!")

# Add viewer_toggle_code right before function resizeViewerCanvas
if 'btnViewerTogglePois' not in code:
    code = code.replace('function resizeViewerCanvas', viewer_toggle_code + '\nfunction resizeViewerCanvas')
    print("Added viewer_toggle_code to app.js!")

# 8. Single click vs double click for panoramas on canvas
old_mouseup_pano = '''  if (state.isDraggingPano) {
    if (!state.hasDragged && state.selectedPanoId && floor && floor.panoramas) {
      const clickedP = floor.panoramas.find(p => p.id === state.selectedPanoId);
      if (clickedP) {
        if (clickedP.image_data) {
          openPanoViewerModal(clickedP);
        } else {
          openPanoEditModal(clickedP);
        }
      }
    }
    state.isDraggingPano = false;
    updateFloorUI();
  }'''

new_mouseup_pano = '''  if (state.isDraggingPano) {
    if (!state.hasDragged && state.selectedPanoId && floor && floor.panoramas) {
      const clickedP = floor.panoramas.find(p => p.id === state.selectedPanoId);
      if (clickedP) {
        if (panoClickTimeout) {
          // Второй клик (двойное нажатие) -> РЕДАКТИРОВАНИЕ
          clearTimeout(panoClickTimeout);
          panoClickTimeout = null;
          openPanoEditModal(clickedP);
        } else {
          // Первый клик -> ждем 230мс для проверки двойного нажатия
          panoClickTimeout = setTimeout(() => {
            panoClickTimeout = null;
            if (clickedP.image_data) {
              openPanoViewerModal(clickedP);
            } else {
              openPanoEditModal(clickedP);
            }
          }, 230);
        }
      }
    }
    state.isDraggingPano = false;
    updateFloorUI();
  }'''

if old_mouseup_pano in code:
    code = code.replace(old_mouseup_pano, new_mouseup_pano)
    print("Updated mouseup with double-click detection for panoramas!")

# Double click handler on canvas
old_dblclick_p = '''  const clickedPano = findPanoAt(world.x, world.y, floor);
  if (clickedPano) {
    openPanoEditModal(clickedPano);
    return;
  }'''

new_dblclick_p = '''  const clickedPano = findPanoAt(world.x, world.y, floor);
  if (clickedPano) {
    if (panoClickTimeout) {
      clearTimeout(panoClickTimeout);
      panoClickTimeout = null;
    }
    closePanoViewerModal();
    openPanoEditModal(clickedPano);
    return;
  }'''

if old_dblclick_p in code:
    code = code.replace(old_dblclick_p, new_dblclick_p)
    print("Updated dblclick event handler for pano!")

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: app.js fully updated with Hotspots & toggle button!")
