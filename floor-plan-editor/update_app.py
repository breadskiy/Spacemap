# -*- coding: utf-8 -*-
app_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\app.js'

with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update renderPanosList
old_render_panos = code[code.find('function renderPanosList(floor) {'):code.find('// 1. МОДАЛЬНОЕ ОКНО: ПАМЯТКА / ИНСТРУКЦИЯ ПО СЪЕМКЕ')]

new_render_panos = '''function renderPanosList(floor) {
  panosListEl.innerHTML = '';
  if (!floor || !floor.panoramas || floor.panoramas.length === 0) {
    panosListEl.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-500">
        <i class="fa-solid fa-street-view text-2xl mb-2 text-slate-600 block"></i>
        Нет созданных панорам.<br>Выберите инструмент "Панорама 360°" и кликните на плане, или перетащите файл фото сюда.
      </div>
    `;
    return;
  }

  floor.panoramas.forEach(pano => {
    const isSelected = state.selectedPanoId === pano.id;
    const isHovered = state.hoverPanoId === pano.id;
    const room = floor.rooms ? floor.rooms.find(r => r.id === pano.room_id) : null;
    const roomName = room ? room.name : 'Без комнаты';
    const hasPhoto = Boolean(pano.image_data);

    const card = document.createElement('div');
    card.className = `p-2.5 px-3 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer ${
      isSelected || isHovered
        ? 'bg-indigo-500/15 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/30' 
        : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        ${hasPhoto 
          ? `<img src="${pano.image_data}" class="w-9 h-9 rounded-lg object-cover shrink-0 border border-indigo-500/50 shadow">`
          : `<div class="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
               <i class="fa-solid fa-street-view text-sm"></i>
             </div>`
        }
        <div class="min-w-0">
          <div class="font-semibold text-white text-[12px] flex items-center gap-1.5 truncate">
            <span class="truncate">${pano.name}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ${hasPhoto ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}">
              ${hasPhoto ? '360° Фото' : 'Ожидает фото'}
            </span>
          </div>
          <div class="text-[10px] text-slate-400 truncate">
            Зона: <span class="text-cyan-400">${roomName}</span> · <span class="font-mono text-indigo-300">(${pano.x}, ${pano.y})</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0 ml-2">
        <button class="btn-view-pano text-indigo-200 hover:text-white bg-indigo-600/30 hover:bg-indigo-600 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 border border-indigo-500/30" title="Открыть 360° просмотр">
          <i class="fa-solid fa-eye text-[10px]"></i>
          <span>360°</span>
        </button>
        <button class="btn-edit-pano text-slate-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-800 transition" title="Заменить фото / редактировать точку">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-del-pano text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition" title="Удалить панораму">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      state.selectedPanoId = pano.id;
      centerOnPoint(pano.x, pano.y);
      render();
      renderPanosList(floor);
    });

    card.querySelector('.btn-view-pano').addEventListener('click', e => {
      e.stopPropagation();
      openPanoViewerModal(pano);
    });

    card.querySelector('.btn-edit-pano').addEventListener('click', e => {
      e.stopPropagation();
      openPanoEditModal(pano);
    });

    card.querySelector('.btn-del-pano').addEventListener('click', e => {
      e.stopPropagation();
      deletePano(floor, pano.id);
      render();
    });

    panosListEl.appendChild(card);
  });
}

'''

code = code.replace(old_render_panos, new_render_panos)

# 2. Replace everything from "// 1. МОДАЛЬНОЕ ОКНО: ПАМЯТКА" up to "function openPanoViewerModal"
pano_section_start = code.find('// 1. МОДАЛЬНОЕ ОКНО: ПАМЯТКА / ИНСТРУКЦИЯ ПО СЪЕМКЕ')
viewer_start = code.find('function openPanoViewerModal(pano) {')

new_pano_section = '''// =============================================================
// ПАНОРАМЫ 360° (ПРИВЯЗКА ФОТО ИЗ PANORAMA 360 & VIRTUAL TOURS)
// =============================================================

const modalPanoHelp = document.getElementById('modal-pano-help');
const btnClosePanoHelp = document.getElementById('btn-close-pano-help');
const btnConfirmPanoHelp = document.getElementById('btn-confirm-pano-help');
const btnOpenPanoGuide = document.getElementById('btn-open-pano-guide');

function openPanoHelpModal() {
  if (modalPanoHelp) {
    modalPanoHelp.style.display = 'flex';
    modalPanoHelp.classList.remove('hidden');
  }
}

function closePanoHelpModal() {
  if (modalPanoHelp) {
    modalPanoHelp.style.display = 'none';
    modalPanoHelp.classList.add('hidden');
  }
}

if (btnClosePanoHelp) btnClosePanoHelp.addEventListener('click', closePanoHelpModal);
if (btnConfirmPanoHelp) btnConfirmPanoHelp.addEventListener('click', closePanoHelpModal);
if (btnOpenPanoGuide) btnOpenPanoGuide.addEventListener('click', openPanoHelpModal);

// Модальное окно редактирования / загрузки панорамы
const modalPanoEdit = document.getElementById('modal-pano-edit');
const modalPanoEditTitle = document.getElementById('modal-pano-edit-title');
const btnClosePanoEdit = document.getElementById('btn-close-pano-edit');
const btnCancelPanoEdit = document.getElementById('btn-cancel-pano-edit');
const formEditPano = document.getElementById('form-edit-pano');
const inputEditPanoName = document.getElementById('input-edit-pano-name');
const selectEditPanoRoom = document.getElementById('select-edit-pano-room');
const labelEditPanoCoords = document.getElementById('label-edit-pano-coords');
const btnDeleteCurrentPano = document.getElementById('btn-delete-current-pano');

const panoDropzone = document.getElementById('pano-dropzone');
const inputPanoFile = document.getElementById('input-pano-file');
const panoPreviewContainer = document.getElementById('pano-preview-container');
const panoPreviewImg = document.getElementById('pano-preview-img');
const panoFileInfoBadge = document.getElementById('pano-file-info-badge');
const panoResolutionTag = document.getElementById('pano-resolution-tag');
const btnPreviewInViewer = document.getElementById('btn-preview-in-viewer');
const btnChangePanoFile = document.getElementById('btn-change-pano-file');

const btnStartPanoCreation = document.getElementById('btn-start-pano-creation');

// Состояние текущего редактирования точки
const panoEditorState = {
  panoId: null,
  x: 0,
  y: 0,
  imageData: null,
  fileName: null,
  width: 0,
  height: 0
};

// Функция чтения файла панорамы через FileReader
function handlePanoImageFile(file, callback) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите файл изображения (.jpg, .png, .webp)');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      callback(dataUrl, {
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
        name: file.name
      });
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function updatePanoPreviewUI(dataUrl, info = null) {
  if (dataUrl) {
    panoEditorState.imageData = dataUrl;
    panoPreviewImg.src = dataUrl;
    if (panoDropzone) panoDropzone.classList.add('hidden');
    if (panoPreviewContainer) panoPreviewContainer.classList.remove('hidden');

    const sizeKb = info && info.size ? Math.round(info.size / 1024) : null;
    const sizeStr = sizeKb ? (sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} МБ` : `${sizeKb} КБ`) : '';
    const resStr = info && info.width ? `${info.width} × ${info.height} px` : '360°';

    if (panoResolutionTag) {
      panoResolutionTag.innerHTML = `<i class="fa-solid fa-check text-[9px]"></i> ${resStr} ${sizeStr ? `· ${sizeStr}` : ''}`;
    }
    if (panoFileInfoBadge) {
      panoFileInfoBadge.innerText = info && info.name ? info.name : '360° фото прикреплено';
    }
  } else {
    panoEditorState.imageData = null;
    panoPreviewImg.src = '';
    if (panoDropzone) panoDropzone.classList.remove('hidden');
    if (panoPreviewContainer) panoPreviewContainer.classList.add('hidden');
    if (panoFileInfoBadge) panoFileInfoBadge.innerText = '';
  }
}

function openPanoEditModal(pano = null, defX = 200, defY = 200, targetRoom = null, preloaded = null) {
  const floor = getCurrentFloor();
  if (!floor) return;

  // Заполняем список комнат
  selectEditPanoRoom.innerHTML = '';
  const noRoomOpt = document.createElement('option');
  noRoomOpt.value = '';
  noRoomOpt.innerText = 'Без привязки к комнате (Холл / Коридор)';
  selectEditPanoRoom.appendChild(noRoomOpt);

  if (floor.rooms && floor.rooms.length > 0) {
    floor.rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.innerText = r.name;
      selectEditPanoRoom.appendChild(opt);
    });
  }

  if (pano) {
    panoEditorState.panoId = pano.id;
    panoEditorState.x = pano.x;
    panoEditorState.y = pano.y;
    panoEditorState.imageData = pano.image_data || null;

    modalPanoEditTitle.innerText = `Редактирование: ${pano.name}`;
    inputEditPanoName.value = pano.name;
    selectEditPanoRoom.value = pano.room_id || '';
    labelEditPanoCoords.innerText = `X: ${pano.x}, Y: ${pano.y}`;

    btnDeleteCurrentPano.classList.remove('hidden');
    updatePanoPreviewUI(pano.image_data);
  } else {
    panoEditorState.panoId = null;
    panoEditorState.x = defX;
    panoEditorState.y = defY;
    panoEditorState.imageData = null;

    modalPanoEditTitle.innerText = 'Новая точка панорамы 360°';
    
    // Понятное имя по умолчанию
    const detectedRoom = targetRoom || (floor ? findRoomAt(defX, defY, floor) : null);
    const roomName = detectedRoom ? detectedRoom.name : 'Точка';
    const nextNum = (floor.panoramas ? floor.panoramas.length : 0) + 1;
    inputEditPanoName.value = `Панорама ${nextNum}: ${roomName}`;

    selectEditPanoRoom.value = detectedRoom ? detectedRoom.id : '';
    labelEditPanoCoords.innerText = `X: ${defX}, Y: ${defY}`;

    btnDeleteCurrentPano.classList.add('hidden');

    if (preloaded && preloaded.imageData) {
      updatePanoPreviewUI(preloaded.imageData, preloaded);
    } else {
      updatePanoPreviewUI(null);
    }
  }

  modalPanoEdit.style.display = 'flex';
  modalPanoEdit.classList.remove('hidden');
  inputEditPanoName.focus();
}

function closePanoEditModal() {
  if (modalPanoEdit) {
    modalPanoEdit.style.display = 'none';
    modalPanoEdit.classList.add('hidden');
  }
}

if (btnClosePanoEdit) btnClosePanoEdit.addEventListener('click', closePanoEditModal);
if (btnCancelPanoEdit) btnCancelPanoEdit.addEventListener('click', closePanoEditModal);

// Выбор файла через диалог
if (panoDropzone) {
  panoDropzone.addEventListener('click', () => {
    if (inputPanoFile) inputPanoFile.click();
  });
}

if (btnChangePanoFile) {
  btnChangePanoFile.addEventListener('click', () => {
    if (inputPanoFile) inputPanoFile.click();
  });
}

if (inputPanoFile) {
  inputPanoFile.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      handlePanoImageFile(e.target.files[0], (dataUrl, info) => {
        updatePanoPreviewUI(dataUrl, info);
      });
    }
  });
}

// Drag & drop внутри модального окна загрузки
if (panoDropzone) {
  panoDropzone.addEventListener('dragover', e => {
    e.preventDefault();
    panoDropzone.classList.add('border-indigo-400', 'bg-indigo-950/40');
  });
  panoDropzone.addEventListener('dragleave', () => {
    panoDropzone.classList.remove('border-indigo-400', 'bg-indigo-950/40');
  });
  panoDropzone.addEventListener('drop', e => {
    e.preventDefault();
    panoDropzone.classList.remove('border-indigo-400', 'bg-indigo-950/40');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePanoImageFile(e.dataTransfer.files[0], (dataUrl, info) => {
        updatePanoPreviewUI(dataUrl, info);
      });
    }
  });
}

// Предпросмотр 360° прямо из окна формы
if (btnPreviewInViewer) {
  btnPreviewInViewer.addEventListener('click', () => {
    if (!panoEditorState.imageData) return;
    const tempPano = {
      id: panoEditorState.panoId || 'temp_preview',
      name: inputEditPanoName.value || 'Предпросмотр 360°',
      room_id: selectEditPanoRoom.value || null,
      x: panoEditorState.x,
      y: panoEditorState.y,
      image_data: panoEditorState.imageData
    };
    openPanoViewerModal(tempPano);
  });
}

// Сохранение точки панорамы
if (formEditPano) {
  formEditPano.addEventListener('submit', e => {
    e.preventDefault();
    const floor = getCurrentFloor();
    if (!floor) return;
    if (!floor.panoramas) floor.panoramas = [];

    const name = inputEditPanoName.value.trim() || 'Панорама 360°';
    const roomId = selectEditPanoRoom.value || null;

    if (panoEditorState.panoId) {
      const existing = floor.panoramas.find(p => p.id === panoEditorState.panoId);
      if (existing) {
        existing.name = name;
        existing.room_id = roomId;
        if (panoEditorState.imageData) {
          existing.image_data = panoEditorState.imageData;
        }
      }
      state.selectedPanoId = existing.id;
      updateStatusHint(`Панорама "${name}" сохранена!`);
    } else {
      const newPano = {
        id: genId('pano'),
        name: name,
        room_id: roomId,
        x: panoEditorState.x,
        y: panoEditorState.y,
        image_data: panoEditorState.imageData || null,
        created_at: new Date().toISOString()
      };
      floor.panoramas.push(newPano);
      state.selectedPanoId = newPano.id;
      updateStatusHint(`Точка панорамы "${name}" добавлена на план!`);

      if (newPano.image_data) {
        openPanoViewerModal(newPano);
      }
    }

    closePanoEditModal();
    updateFloorUI();
    render();
  });
}

// Удаление точки
if (btnDeleteCurrentPano) {
  btnDeleteCurrentPano.addEventListener('click', () => {
    const floor = getCurrentFloor();
    if (!floor || !panoEditorState.panoId) return;
    if (confirm('Удалить эту точку панорамы?')) {
      deletePano(floor, panoEditorState.panoId);
      closePanoEditModal();
      render();
    }
  });
}

// Кнопка добавления в сайдбаре
if (btnStartPanoCreation) {
  btnStartPanoCreation.addEventListener('click', () => {
    setTool('pano');
    switchSidebarTab('panos');
    updateStatusHint('Кликните по плану или перетащите файл 360° фото прямо на комнату!');
  });
}

// Перетаскивание файлов 360° фото прямо на холст плана!
canvas.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

canvas.addEventListener('drop', e => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, перетащите файл изображения (.jpg, .png, .webp)');
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const targetRoom = findRoomAt(world.x, world.y, floor);
  handlePanoImageFile(file, (dataUrl, info) => {
    openPanoEditModal(null, snap(world.x), snap(world.y), targetRoom, {
      imageData: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      width: info.width,
      height: info.height
    });
  });
});

// Генерация запасной эквидистантной текстуры для пустой точки
function generatePanoTexture(roomName, roomColor) {
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 2400;
  pCanvas.height = 1200;
  const pCtx = pCanvas.getContext('2d');
  const pw = pCanvas.width;
  const ph = pCanvas.height;

  // Потолок
  const ceilGrad = pCtx.createLinearGradient(0, 0, 0, ph * 0.45);
  ceilGrad.addColorStop(0, '#090d16');
  ceilGrad.addColorStop(1, '#1e293b');
  pCtx.fillStyle = ceilGrad;
  pCtx.fillRect(0, 0, pw, ph * 0.45);

  // Стены
  const wallGrad = pCtx.createLinearGradient(0, ph * 0.45, 0, ph * 0.7);
  wallGrad.addColorStop(0, '#1e293b');
  wallGrad.addColorStop(1, '#0f172a');
  pCtx.fillStyle = wallGrad;
  pCtx.fillRect(0, ph * 0.45, pw, ph * 0.25);

  // Пол
  const floorGrad = pCtx.createLinearGradient(0, ph * 0.7, 0, ph);
  floorGrad.addColorStop(0, '#0f172a');
  floorGrad.addColorStop(1, '#020617');
  pCtx.fillStyle = floorGrad;
  pCtx.fillRect(0, ph * 0.7, pw, ph * 0.3);

  // Горизонтальные линии и сетка
  pCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  pCtx.lineWidth = 2;
  pCtx.beginPath();
  pCtx.moveTo(0, ph * 0.45); pCtx.lineTo(pw, ph * 0.45);
  pCtx.moveTo(0, ph * 0.7); pCtx.lineTo(pw, ph * 0.7);
  pCtx.stroke();

  // Надписи в 4 сторонах света
  const dirs = ['Север (0°)', 'Восток (90°)', 'Юг (180°)', 'Запад (270°)'];
  for (let i = 0; i < 4; i++) {
    const x = (pw / 4) * i + pw / 8;
    pCtx.fillStyle = '#6366f1';
    pCtx.font = 'bold 38px sans-serif';
    pCtx.textAlign = 'center';
    pCtx.fillText(`[${dirs[i]}] 360° Виртуальный тур · ${roomName}`, x, ph * 0.54);

    pCtx.font = '24px sans-serif';
    pCtx.fillStyle = '#94a3b8';
    pCtx.fillText('Нажмите «Заменить фото» вверху, чтобы прикрепить снимок из Panorama 360', x, ph * 0.60);
  }

  return pCanvas.toDataURL('image/jpeg', 0.88);
}

'''

code = code[:pano_section_start] + new_pano_section + code[viewer_start:]

# 3. Update mouseup for instant 360 viewer opening on click
old_mouseup_pano = '''  if (state.isDraggingPano) {
    state.isDraggingPano = false;
    updateFloorUI();
  }'''

new_mouseup_pano = '''  if (state.isDraggingPano) {
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

if old_mouseup_pano in code:
    code = code.replace(old_mouseup_pano, new_mouseup_pano)

# 4. Update canvas mousedown for tool === 'pano'
old_pano_tool = '''  // Режим ПАНОРАМА 360°
  if (state.tool === 'pano') {
    if (clickedPano) {
      state.selectedPanoId = clickedPano.id;
      openPanoViewerModal(clickedPano);
      render();
      return;
    } else {
      // Клик по холсту/комнате — создать новую панораму
      const targetRoom = clickedRoom || findRoomAt(world.x, world.y, floor);
      openPanoCaptureModal(targetRoom, snap(world.x), snap(world.y));
      render();
      return;
    }
  }'''

new_pano_tool = '''  // Режим ПАНОРАМА 360°
  if (state.tool === 'pano') {
    if (clickedPano) {
      state.selectedPanoId = clickedPano.id;
      if (clickedPano.image_data) {
        openPanoViewerModal(clickedPano);
      } else {
        openPanoEditModal(clickedPano);
      }
      render();
      return;
    } else {
      // Клик по холсту/комнате — создать новую точку панорамы
      const targetRoom = clickedRoom || findRoomAt(world.x, world.y, floor);
      openPanoEditModal(null, snap(world.x), snap(world.y), targetRoom);
      render();
      return;
    }
  }'''

if old_pano_tool in code:
    code = code.replace(old_pano_tool, new_pano_tool)

# 5. Update canvas dblclick for pano
old_dblclick = '''  const clickedPano = findPanoAt(world.x, world.y, floor);
  if (clickedPano) {
    openPanoViewerModal(clickedPano);
    return;
  }'''

new_dblclick = '''  const clickedPano = findPanoAt(world.x, world.y, floor);
  if (clickedPano) {
    openPanoEditModal(clickedPano);
    return;
  }'''

if old_dblclick in code:
    code = code.replace(old_dblclick, new_dblclick)

# 6. Add buttons for 360 viewer (replace photo and fullscreen)
viewer_btns_hook = "if (btnCloseViewer) btnCloseViewer.addEventListener('click', closePanoViewerModal);"
viewer_btns_addon = """if (btnCloseViewer) btnCloseViewer.addEventListener('click', closePanoViewerModal);

const btnViewerEditPoint = document.getElementById('btn-viewer-edit-point');
const btnViewerFullscreen = document.getElementById('btn-viewer-fullscreen');

if (btnViewerEditPoint) {
  btnViewerEditPoint.addEventListener('click', () => {
    if (viewerState.pano) {
      closePanoViewerModal();
      openPanoEditModal(viewerState.pano);
    }
  });
}

if (btnViewerFullscreen) {
  btnViewerFullscreen.addEventListener('click', () => {
    const vModal = document.getElementById('modal-pano-viewer');
    if (!document.fullscreenElement) {
      if (vModal && vModal.requestFullscreen) vModal.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  });
}"""

if viewer_btns_hook in code:
    code = code.replace(viewer_btns_hook, viewer_btns_addon)

# 7. Update Esc key to close new modal
code = code.replace('closePanoCaptureModal();', 'closePanoEditModal();')

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: app.js updated!")
