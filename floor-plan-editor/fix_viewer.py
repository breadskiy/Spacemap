# -*- coding: utf-8 -*-
html_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\index.html'
app_path = r'C:\Users\Дима\.gemini\antigravity\scratch\floor-plan-editor\app.js'

# 1. Update index.html to add #btn-modal-preview-360 in modal-pano-edit footer
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

old_footer_btns = '''          <div class="flex items-center gap-2 ml-auto">
            <button type="button" id="btn-cancel-pano-edit" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition">
              Отмена
            </button>'''

new_footer_btns = '''          <div class="flex items-center gap-2 ml-auto">
            <button type="button" id="btn-modal-preview-360" class="px-3.5 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow">
              <i class="fa-solid fa-eye"></i>
              <span>Посмотреть в 360°</span>
            </button>
            <button type="button" id="btn-cancel-pano-edit" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition">
              Отмена
            </button>'''

if old_footer_btns in html:
    html = html.replace(old_footer_btns, new_footer_btns)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("index.html updated with btn-modal-preview-360!")
else:
    print("Could not find old_footer_btns in index.html")

# 2. Update app.js
with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

viewer_declarations = '''// -------------------------------------------------------------
// ИНТЕРАКТИВНЫЙ 360° ПРОСМОТРЩИК ПАНОРАМЫ
// -------------------------------------------------------------
const modalPanoViewer = document.getElementById('modal-pano-viewer');
const viewerPanoTitle = document.getElementById('viewer-pano-title');
const viewerRoomBadge = document.getElementById('viewer-room-badge');
const viewerFloorBadge = document.getElementById('viewer-floor-badge');
const viewerCoordsBadge = document.getElementById('viewer-coords-badge');
const viewer360Canvas = document.getElementById('viewer-360-canvas');
const viewer360Ctx = viewer360Canvas ? viewer360Canvas.getContext('2d') : null;
const btnCloseViewer = document.getElementById('btn-close-viewer');
const btnViewerDownload = document.getElementById('btn-viewer-download');
const btnViewerAutorotate = document.getElementById('btn-viewer-autorotate');
const iconAutorotate = document.getElementById('icon-rotate') || document.getElementById('icon-autorotate');
const btnViewerZoomIn = document.getElementById('btn-viewer-zoom-in');
const btnViewerZoomOut = document.getElementById('btn-viewer-zoom-out');
const btnViewerReset = document.getElementById('btn-viewer-reset');

const viewerState = {
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
};

'''

target_open_viewer = 'function openPanoViewerModal(pano) {'
if target_open_viewer in code and 'const modalPanoViewer' not in code:
    code = code.replace(target_open_viewer, viewer_declarations + target_open_viewer)
    print("Added viewer declarations to app.js!")

# Update btnPreviewInViewer and formEditPano submit
old_submit_block = code[code.find('// Предпросмотр 360° прямо из окна формы'):code.find('// Удаление точки\nif (btnDeleteCurrentPano)')]

new_submit_block = '''// Предпросмотр 360° прямо из окна формы
const btnModalPreview360 = document.getElementById('btn-modal-preview-360');

function triggerPreviewInViewer() {
  const floor = getCurrentFloor();
  const tempPano = {
    id: panoEditorState.panoId || 'temp_preview',
    name: inputEditPanoName.value.trim() || 'Предпросмотр 360°',
    room_id: selectEditPanoRoom.value || null,
    x: panoEditorState.x,
    y: panoEditorState.y,
    image_data: panoEditorState.imageData || null
  };
  closePanoEditModal();
  openPanoViewerModal(tempPano);
}

if (btnPreviewInViewer) btnPreviewInViewer.addEventListener('click', triggerPreviewInViewer);
if (btnModalPreview360) btnModalPreview360.addEventListener('click', triggerPreviewInViewer);

// Сохранение точки панорамы
if (formEditPano) {
  formEditPano.addEventListener('submit', e => {
    e.preventDefault();
    const floor = getCurrentFloor();
    if (!floor) return;
    if (!floor.panoramas) floor.panoramas = [];

    const name = inputEditPanoName.value.trim() || 'Панорама 360°';
    const roomId = selectEditPanoRoom.value || null;

    let savedPano = null;
    if (panoEditorState.panoId) {
      const existing = floor.panoramas.find(p => p.id === panoEditorState.panoId);
      if (existing) {
        existing.name = name;
        existing.room_id = roomId;
        if (panoEditorState.imageData) {
          existing.image_data = panoEditorState.imageData;
        }
        savedPano = existing;
      }
      state.selectedPanoId = panoEditorState.panoId;
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
      savedPano = newPano;
      updateStatusHint(`Точка панорамы "${name}" добавлена на план!`);
    }

    closePanoEditModal();
    updateFloorUI();
    render();

    if (savedPano) {
      openPanoViewerModal(savedPano);
    }
  });
}

'''

if old_submit_block:
    code = code.replace(old_submit_block, new_submit_block)
    print("Updated submit and preview handlers in app.js!")

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: Fixes applied to app.js!")
