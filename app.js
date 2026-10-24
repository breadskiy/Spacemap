// Состояние проекта
const state = {
  activeFloorId: 'floor-1',
  floors: [
    {
      id: 'floor-1',
      name: '1 этаж',
      level: 1,
      height: 3.5,
      // Чистый холст при открытии
      corners: [],
      walls: []
    }
  ],
  tool: 'corner', // 'corner' | 'wall' | 'delete'
  selectedCornerId: null,
  wallStartCornerId: null,
  hoverCornerId: null,
  hoverWallId: null,
  editingCornerId: null,

  // Отслеживание естественного перетаскивания (зажал точку и потянул)
  dragStartMouse: { x: 0, y: 0 },
  hasDragged: false,

  // Начало координат расположено с отступом слева и снизу
  pan: { x: 120, y: 550 },
  zoom: 1.0,
  isPanning: false,
  isDraggingCorner: false,
  panStart: { x: 0, y: 0 },
  mouseWorld: { x: 0, y: 0 },
  gridStep: 20,
  majorGridStep: 100
};

const canvas = document.getElementById('viewport-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}
window.addEventListener('resize', resizeCanvas);

function getCurrentFloor() {
  let floor = state.floors.find(f => f.id === state.activeFloorId);
  if (!floor && state.floors.length > 0) {
    state.activeFloorId = state.floors[0].id;
    floor = state.floors[0];
  }
  return floor;
}

// -------------------------------------------------------------
// КООРДИНАТНЫЕ ПРЕОБРАЗОВАНИЯ (Декартова система: +X вправо, +Y вверх)
// -------------------------------------------------------------
function screenToWorld(sx, sy) {
  return {
    x: (sx - state.pan.x) / state.zoom,
    y: (state.pan.y - sy) / state.zoom // Инверсия Y: экран вниз -> мир вверх
  };
}

function worldToScreen(wx, wy) {
  return {
    x: state.pan.x + wx * state.zoom,
    y: state.pan.y - wy * state.zoom
  };
}

// Перевод мировой координаты точки в координату внутри трансформированного Canvas
// В Canvas origin = (pan.x, pan.y). Внутри Canvas: cx = wx, cy = -wy.
function worldToCanvas(wx, wy) {
  return {
    x: wx,
    y: -wy
  };
}

function snap(val, step = state.gridStep) {
  return Math.round(val / step) * step;
}

function calcDist(p1, p2) {
  return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Генерация уникальных ID
function genCornerId(floor) {
  let max = 0;
  if (floor && Array.isArray(floor.corners)) {
    floor.corners.forEach(c => {
      const num = parseInt(c.id);
      if (!isNaN(num) && num > max) max = num;
    });
  }
  return (max + 1).toString();
}

function genId(prefix) {
  return `${prefix}_${Math.floor(Math.random() * 10000)}`;
}

function recalculateWallLengths(floor) {
  floor.walls.forEach(w => {
    const c1 = floor.corners.find(c => c.id === w.from);
    const c2 = floor.corners.find(c => c.id === w.to);
    if (c1 && c2) {
      w.length = calcDist(c1, c2);
    }
  });
}

// -------------------------------------------------------------
// ОТРИСОВКА
// -------------------------------------------------------------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  // 1. Координатная декартова сетка
  drawCartesianGrid();

  const floor = getCurrentFloor();
  if (floor) {
    // 2. Заливка комнат
    drawRoomFills(floor);

    // 3. Стены
    drawWalls(floor);

    // 4. Предпросмотр стены
    if (state.tool === 'wall' && state.wallStartCornerId) {
      const startCorner = floor.corners.find(c => c.id === state.wallStartCornerId);
      if (startCorner) {
        const scPos = worldToCanvas(startCorner.x, startCorner.y);
        const curPos = worldToCanvas(state.mouseWorld.x, state.mouseWorld.y);

        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3 / state.zoom;
        ctx.moveTo(scPos.x, scPos.y);
        ctx.lineTo(curPos.x, curPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const tempDist = calcDist(startCorner, state.mouseWorld);
        const midX = (scPos.x + curPos.x) / 2;
        const midY = (scPos.y + curPos.y) / 2;
        drawLengthBadge(`${tempDist} px`, midX, midY, true);
      }
    }

    // 5. Углы (точки)
    drawCorners(floor);
  }

  ctx.restore();
  updateStats();
}

// Декартова сетка: X вправо (+), Y вверх (+)
function drawCartesianGrid() {
  const step = state.gridStep;
  const majorStep = state.majorGridStep;

  // Границы видимой области в мировых координатах
  const minX = -state.pan.x / state.zoom;
  const maxX = (canvas.width - state.pan.x) / state.zoom;
  const maxY = state.pan.y / state.zoom;
  const minY = (state.pan.y - canvas.height) / state.zoom;

  const startGridX = Math.floor(minX / step) * step;
  const endGridX = Math.ceil(maxX / step) * step;
  const startGridY = Math.floor(minY / step) * step;
  const endGridY = Math.ceil(maxY / step) * step;

  // 1. Мелкая сетка (20px)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
  ctx.lineWidth = 1 / state.zoom;

  for (let x = startGridX; x <= endGridX; x += step) {
    if (x % majorStep !== 0) {
      ctx.moveTo(x, -minY);
      ctx.lineTo(x, -maxY);
    }
  }
  for (let y = startGridY; y <= endGridY; y += step) {
    if (y % majorStep !== 0) {
      ctx.moveTo(minX, -y);
      ctx.lineTo(maxX, -y);
    }
  }
  ctx.stroke();

  // 2. Крупная сетка (100px)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1.2 / state.zoom;

  for (let x = Math.floor(minX / majorStep) * majorStep; x <= endGridX; x += majorStep) {
    ctx.moveTo(x, -minY);
    ctx.lineTo(x, -maxY);
  }
  for (let y = Math.floor(minY / majorStep) * majorStep; y <= endGridY; y += majorStep) {
    ctx.moveTo(minX, -y);
    ctx.lineTo(maxX, -y);
  }
  ctx.stroke();

  // 3. Главные оси координат
  // Ось X (красная): y = 0
  ctx.beginPath();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2 / state.zoom;
  ctx.moveTo(minX, 0);
  ctx.lineTo(maxX, 0);
  ctx.stroke();

  // Ось Y (зеленая): x = 0
  ctx.beginPath();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2 / state.zoom;
  ctx.moveTo(0, -minY);
  ctx.lineTo(0, -maxY);
  ctx.stroke();

  // Стрелочка и метка +X
  ctx.fillStyle = '#ef4444';
  ctx.font = `bold ${Math.max(10, 11 / state.zoom)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('+X →', maxX - (10 / state.zoom), -5 / state.zoom);

  // Стрелочка и метка +Y
  ctx.fillStyle = '#10b981';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('↑ +Y', 6 / state.zoom, -maxY + (10 / state.zoom));

  // Числовые засечки вдоль осей
  ctx.save();
  ctx.font = `${Math.max(9, 10 / state.zoom)}px monospace`;
  ctx.fillStyle = '#94a3b8';

  // Числа по оси X
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.floor(minX / majorStep) * majorStep; x <= endGridX; x += majorStep) {
    if (x !== 0) {
      ctx.fillText(x.toString(), x, 5 / state.zoom);
    }
  }

  // Числа по оси Y (обратите внимание: на canvas рисуем в -y)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.floor(minY / majorStep) * majorStep; y <= endGridY; y += majorStep) {
    if (y !== 0) {
      ctx.fillText(y.toString(), -6 / state.zoom, -y);
    }
  }

  // Начало координат (0,0)
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0,0', -4 / state.zoom, -4 / state.zoom);
  ctx.restore();
}

function drawRoomFills(floor) {
  if (floor.corners.length >= 3 && floor.walls.length >= 3) {
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
    ctx.beginPath();
    const first = worldToCanvas(floor.corners[0].x, floor.corners[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < floor.corners.length; i++) {
      const pt = worldToCanvas(floor.corners[i].x, floor.corners[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawWalls(floor) {
  floor.walls.forEach(w => {
    const c1 = floor.corners.find(c => c.id === w.from);
    const c2 = floor.corners.find(c => c.id === w.to);
    if (!c1 || !c2) return;

    const p1 = worldToCanvas(c1.x, c1.y);
    const p2 = worldToCanvas(c2.x, c2.y);
    const isHovered = state.hoverWallId === w.id;
    const isDeleteMode = state.tool === 'delete' || state.tool === 'wall';

    ctx.beginPath();
    ctx.strokeStyle = isHovered && isDeleteMode ? '#f43f5e' : (isHovered ? '#60a5fa' : '#cbd5e1');
    ctx.lineWidth = (isHovered ? 6 : 4) / state.zoom;
    ctx.lineCap = 'round';
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    drawLengthBadge(`${w.length || calcDist(c1, c2)}`, midX, midY, isHovered);
  });
}

function drawLengthBadge(text, x, y, isHighlight = false) {
  ctx.save();
  ctx.font = `bold ${Math.max(10, 11 / state.zoom)}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const paddingX = 5 / state.zoom;
  const h = 14 / state.zoom;

  ctx.fillStyle = isHighlight ? '#1e293b' : '#0f172a';
  ctx.strokeStyle = isHighlight ? '#38bdf8' : '#475569';
  ctx.lineWidth = 1 / state.zoom;

  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - paddingX, y - h / 2, textWidth + paddingX * 2, h, 3 / state.zoom);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isHighlight ? '#38bdf8' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCorners(floor) {
  floor.corners.forEach(c => {
    const pos = worldToCanvas(c.x, c.y);
    const isSelected = state.selectedCornerId === c.id;
    const isHovered = state.hoverCornerId === c.id;
    const isWallStart = state.wallStartCornerId === c.id;

    const radius = (isSelected || isHovered || isWallStart ? 8 : 6) / state.zoom;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

    if (isWallStart) {
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ecfdf5';
    } else if (state.tool === 'delete' && isHovered) {
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#ffe4e6';
    } else if (isSelected || isHovered) {
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
    }

    ctx.lineWidth = 2 / state.zoom;
    ctx.fill();
    ctx.stroke();

    drawCornerCoordsBadge(c, pos, radius, isHovered || isSelected);
  });
}

function drawCornerCoordsBadge(corner, canvasPos, radius, isHighlight) {
  ctx.save();
  const textTitle = corner.id;
  const textCoords = `(${corner.x}, ${corner.y})`;
  
  const fontSize = Math.max(9, 10 / state.zoom);
  ctx.font = `bold ${fontSize}px monospace`;
  
  const widthTitle = ctx.measureText(textTitle).width;
  ctx.font = `${fontSize}px monospace`;
  const widthCoords = ctx.measureText(textCoords).width;
  const totalWidth = widthTitle + widthCoords + (10 / state.zoom);
  const badgeH = 15 / state.zoom;

  const badgeX = canvasPos.x;
  const badgeY = canvasPos.y - radius - (12 / state.zoom);

  ctx.fillStyle = isHighlight ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = isHighlight ? '#f59e0b' : '#334155';
  ctx.lineWidth = 1 / state.zoom;

  ctx.beginPath();
  ctx.roundRect(badgeX - totalWidth / 2, badgeY - badgeH / 2, totalWidth, badgeH, 4 / state.zoom);
  ctx.fill();
  ctx.stroke();

  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = isHighlight ? '#fbbf24' : '#f87171';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const startTextX = badgeX - totalWidth / 2 + (5 / state.zoom);
  ctx.fillText(textTitle, startTextX, badgeY);

  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(textCoords, startTextX + widthTitle + (4 / state.zoom), badgeY);

  ctx.restore();
}

function findCornerAt(wx, wy, threshold = 14 / state.zoom) {
  const floor = getCurrentFloor();
  if (!floor) return null;
  return floor.corners.find(c => Math.hypot(c.x - wx, c.y - wy) <= threshold);
}

function findWallAt(wx, wy, threshold = 10 / state.zoom) {
  const floor = getCurrentFloor();
  if (!floor) return null;
  return floor.walls.find(w => {
    const c1 = floor.corners.find(c => c.id === w.from);
    const c2 = floor.corners.find(c => c.id === w.to);
    if (!c1 || !c2) return false;
    return distToSegment(wx, wy, c1.x, c1.y, c2.x, c2.y) <= threshold;
  });
}

// -------------------------------------------------------------
// ОБРАБОТЧИКИ СОБЫТИЙ МЫШИ
// -------------------------------------------------------------

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);

  // Панорамирование
  if (e.button === 1 || e.shiftKey) {
    state.isPanning = true;
    state.panStart = { x: sx - state.pan.x, y: sy - state.pan.y };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedCorner = findCornerAt(world.x, world.y);
  const clickedWall = findWallAt(world.x, world.y);

  if (state.tool === 'delete') {
    if (clickedCorner) {
      deleteCorner(floor, clickedCorner.id);
    } else if (clickedWall) {
      deleteWall(floor, clickedWall.id);
    }
    render();
    return;
  }

  // Если нажали на существующую точку — активируем готовность к перетаскиванию
  if (clickedCorner) {
    state.selectedCornerId = clickedCorner.id;
    state.isDraggingCorner = true;
    state.dragStartMouse = { x: sx, y: sy };
    state.hasDragged = false;
    canvas.style.cursor = 'grabbing';
    updateStatusHint(`Точка [${clickedCorner.id}]: зажмите и тяните для перемещения.`);
  } else {
    // Нажатие в пустое место
    if (state.tool === 'corner') {
      const targetX = snap(world.x);
      const targetY = snap(world.y);
      openCornerCreateModal(targetX, targetY);
    } else if (state.tool === 'wall') {
      state.wallStartCornerId = null;
      updateStatusHint('Кликните по начальной точке стены');
    }

    // Панорамирование холста при зажатии пустого места
    state.selectedCornerId = null;
    state.isPanning = true;
    state.panStart = { x: sx - state.pan.x, y: sy - state.pan.y };
  }

  render();
});

// ПКМ: Удаление точек и стен
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedCorner = findCornerAt(world.x, world.y);
  const clickedWall = findWallAt(world.x, world.y);

  if (state.tool === 'corner') {
    if (clickedCorner) {
      deleteCorner(floor, clickedCorner.id);
      render();
      return;
    }
  }

  if (state.tool === 'wall') {
    if (state.wallStartCornerId) {
      state.wallStartCornerId = null;
      updateStatusHint('Выбор начальной точки сброшен.');
      render();
      return;
    }
    if (clickedWall) {
      deleteWall(floor, clickedWall.id);
      render();
      return;
    }
  }

  if (state.tool === 'select') {
    if (clickedCorner) {
      deleteCorner(floor, clickedCorner.id);
      render();
      return;
    } else if (clickedWall) {
      deleteWall(floor, clickedWall.id);
      render();
      return;
    }
  }
});

function deleteCorner(floor, cornerId) {
  floor.corners = floor.corners.filter(c => c.id !== cornerId);
  floor.walls = floor.walls.filter(w => w.from !== cornerId && w.to !== cornerId);
  if (state.selectedCornerId === cornerId) state.selectedCornerId = null;
  if (state.wallStartCornerId === cornerId) state.wallStartCornerId = null;
  updateFloorUI();
  updateStatusHint(`Точка ${cornerId} удалена.`);
}

function deleteWall(floor, wallId) {
  floor.walls = floor.walls.filter(w => w.id !== wallId);
  updateFloorUI();
  updateStatusHint(`Стена удалена.`);
}

// ДВОЙНОЙ КЛИК: Редактирование координат точки
canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedCorner = findCornerAt(world.x, world.y);
  if (clickedCorner) {
    openCornerEditModal(clickedCorner);
  }
});

// -------------------------------------------------------------
// МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ТОЧКИ (АБСОЛЮТНЫЕ / ОТНОСИТЕЛЬНЫЕ)
// -------------------------------------------------------------

const modalCornerCreate = document.getElementById('modal-corner-create');
const formCreateCorner = document.getElementById('form-create-corner');
const tabModeAbsolute = document.getElementById('tab-mode-absolute');
const tabModeRelative = document.getElementById('tab-mode-relative');
const sectionModeAbsolute = document.getElementById('section-mode-absolute');
const sectionModeRelative = document.getElementById('section-mode-relative');

const inputCreateX = document.getElementById('input-create-x');
const inputCreateY = document.getElementById('input-create-y');
const selectRelativeBase = document.getElementById('select-relative-base');
const inputRelDx = document.getElementById('input-rel-dx');
const inputRelDy = document.getElementById('input-rel-dy');
const checkConnectWall = document.getElementById('check-connect-wall');
const previewFinalCoords = document.getElementById('preview-final-coords');

let currentCreateMode = 'absolute'; // 'absolute' | 'relative'

function setCreateMode(mode) {
  currentCreateMode = mode;
  if (mode === 'absolute') {
    tabModeAbsolute.className = 'flex-1 py-1.5 rounded-lg font-semibold bg-red-600 text-white transition';
    tabModeRelative.className = 'flex-1 py-1.5 rounded-lg font-medium text-slate-400 hover:text-white transition';
    sectionModeAbsolute.classList.remove('hidden');
    sectionModeRelative.classList.add('hidden');
  } else {
    tabModeRelative.className = 'flex-1 py-1.5 rounded-lg font-semibold bg-red-600 text-white transition';
    tabModeAbsolute.className = 'flex-1 py-1.5 rounded-lg font-medium text-slate-400 hover:text-white transition';
    sectionModeRelative.classList.remove('hidden');
    sectionModeAbsolute.classList.add('hidden');
  }
  updateCreatePreview();
}

tabModeAbsolute.addEventListener('click', () => setCreateMode('absolute'));
tabModeRelative.addEventListener('click', () => setCreateMode('relative'));

function getFinalCalculatedCoords() {
  const floor = getCurrentFloor();
  if (currentCreateMode === 'absolute') {
    return {
      x: parseInt(inputCreateX.value) || 0,
      y: parseInt(inputCreateY.value) || 0
    };
  } else {
    const baseId = selectRelativeBase.value;
    const baseCorner = floor ? floor.corners.find(c => c.id === baseId) : null;
    const dx = parseInt(inputRelDx.value) || 0;
    const dy = parseInt(inputRelDy.value) || 0;
    if (baseCorner) {
      return {
        x: baseCorner.x + dx,
        y: baseCorner.y + dy
      };
    }
    return { x: dx, y: dy };
  }
}

function updateCreatePreview() {
  const coords = getFinalCalculatedCoords();
  previewFinalCoords.innerText = `X: ${coords.x}, Y: ${coords.y}`;
}

[inputCreateX, inputCreateY, inputRelDx, inputRelDy].forEach(inp => {
  inp.addEventListener('input', updateCreatePreview);
});

selectRelativeBase.addEventListener('change', updateCreatePreview);

function openCornerCreateModal(defaultX, defaultY) {
  const floor = getCurrentFloor();
  inputCreateX.value = defaultX;
  inputCreateY.value = defaultY;

  // Заполняем список базовых точек
  selectRelativeBase.innerHTML = '';
  if (floor && floor.corners.length > 0) {
    // Находим ближайшую точку к месту клика
    let nearest = floor.corners[0];
    let minDist = Math.hypot(nearest.x - defaultX, nearest.y - defaultY);

    floor.corners.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = `${c.id} (${c.x}, ${c.y})`;
      selectRelativeBase.appendChild(opt);

      const d = Math.hypot(c.x - defaultX, c.y - defaultY);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    });

    selectRelativeBase.value = nearest.id;
    inputRelDx.value = defaultX - nearest.x;
    inputRelDy.value = defaultY - nearest.y;
    tabModeRelative.classList.remove('opacity-40', 'pointer-events-none');
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = 'Нет существующих точек на этаже';
    selectRelativeBase.appendChild(opt);
    tabModeRelative.classList.add('opacity-40', 'pointer-events-none');
    setCreateMode('absolute');
  }

  setCreateMode('absolute');
  updateCreatePreview();
  modalCornerCreate.classList.remove('hidden');
  inputCreateX.focus();
  inputCreateX.select();
}

function closeCornerCreateModal() {
  modalCornerCreate.classList.add('hidden');
}

document.getElementById('btn-close-create-modal').addEventListener('click', closeCornerCreateModal);
document.getElementById('btn-cancel-create-modal').addEventListener('click', closeCornerCreateModal);

formCreateCorner.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor) return;

  const finalCoords = getFinalCalculatedCoords();

  // Защита от создания в координатах существующей точки
  const conflict = floor.corners.find(c => c.x === finalCoords.x && c.y === finalCoords.y);
  if (conflict) {
    alert(`В координатах (${finalCoords.x}, ${finalCoords.y}) уже существует точка [${conflict.id}]!`);
    return;
  }

  const newCorner = {
    id: genCornerId(floor),
    x: finalCoords.x,
    y: finalCoords.y
  };
  floor.corners.push(newCorner);
  state.selectedCornerId = newCorner.id;

  // Если был выбран относительный режим и стоит галочка "соединить стеной"
  if (currentCreateMode === 'relative' && checkConnectWall.checked && selectRelativeBase.value) {
    const baseCorner = floor.corners.find(c => c.id === selectRelativeBase.value);
    if (baseCorner) {
      floor.walls.push({
        id: genId('w'),
        from: baseCorner.id,
        to: newCorner.id,
        length: calcDist(baseCorner, newCorner)
      });
    }
  }

  updateFloorUI();
  render();
  closeCornerCreateModal();
  updateStatusHint(`Создана точка ${newCorner.id} (${newCorner.x}, ${newCorner.y})`);
});

// Закрытие модальных окон по Esc
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCornerCreateModal();
    closeCornerEditModal();
    modalJson.classList.add('hidden');
  }
});

const modalCornerEdit = document.getElementById('modal-corner-edit');
const editCornerIdLabel = document.getElementById('edit-corner-id');
const inputCornerX = document.getElementById('input-corner-x');
const inputCornerY = document.getElementById('input-corner-y');
const formEditCorner = document.getElementById('form-edit-corner');

function openCornerEditModal(corner) {
  state.editingCornerId = corner.id;
  editCornerIdLabel.innerText = `[${corner.id}]`;
  inputCornerX.value = corner.x;
  inputCornerY.value = corner.y;
  modalCornerEdit.classList.remove('hidden');
  inputCornerX.focus();
  inputCornerX.select();
}

function closeCornerEditModal() {
  modalCornerEdit.classList.add('hidden');
  state.editingCornerId = null;
}

document.getElementById('btn-close-corner-modal').addEventListener('click', closeCornerEditModal);
document.getElementById('btn-cancel-corner-modal').addEventListener('click', closeCornerEditModal);

formEditCorner.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor || !state.editingCornerId) return;

  const corner = floor.corners.find(c => c.id === state.editingCornerId);
  if (corner) {
    const newX = parseInt(inputCornerX.value) || 0;
    const newY = parseInt(inputCornerY.value) || 0;

    // Проверка на совпадение с другой существующей точкой
    const conflict = floor.corners.find(c => c.id !== corner.id && c.x === newX && c.y === newY);
    if (conflict) {
      alert(`В координатах (${newX}, ${newY}) уже есть точка [${conflict.id}]! Координаты должны быть уникальными.`);
      return;
    }

    corner.x = newX;
    corner.y = newY;
    recalculateWallLengths(floor);
    render();
  }
  closeCornerEditModal();
});

// Мышь и перемещение
window.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (state.isPanning) {
    state.pan.x = sx - state.panStart.x;
    state.pan.y = sy - state.panStart.y;
    render();
    return;
  }

  const world = screenToWorld(sx, sy);
  state.mouseWorld = { x: snap(world.x), y: snap(world.y) };

  const floor = getCurrentFloor();
  if (floor) {
    if (state.isDraggingCorner && state.selectedCornerId) {
      // Если мышь сдвинулась от точки нажатия больше чем на 3px, фиксируем drag
      const mouseDist = Math.hypot(sx - state.dragStartMouse.x, sy - state.dragStartMouse.y);
      if (mouseDist > 3) {
        state.hasDragged = true;
      }

      const corner = floor.corners.find(c => c.id === state.selectedCornerId);
      if (corner) {
        corner.x = snap(world.x);
        corner.y = snap(world.y);
        recalculateWallLengths(floor);
      }
    }

    state.hoverCornerId = findCornerAt(world.x, world.y)?.id || null;
    state.hoverWallId = findWallAt(world.x, world.y)?.id || null;
  }

  render();
});

window.addEventListener('mouseup', () => {
  const floor = getCurrentFloor();

  if (state.isDraggingCorner && floor) {
    // Если это был режим "Стена", и пользователь НЕ тянул точку (а просто кликнул по ней)
    if (state.tool === 'wall' && !state.hasDragged && state.selectedCornerId) {
      const corner = floor.corners.find(c => c.id === state.selectedCornerId);
      if (corner) {
        if (!state.wallStartCornerId) {
          state.wallStartCornerId = corner.id;
          updateStatusHint(`Стена от точки [${corner.id}]: теперь кликните по второй точке`);
        } else if (state.wallStartCornerId !== corner.id) {
          const exists = floor.walls.some(w => 
            (w.from === state.wallStartCornerId && w.to === corner.id) ||
            (w.from === corner.id && w.to === state.wallStartCornerId)
          );

          if (!exists) {
            const c1 = floor.corners.find(c => c.id === state.wallStartCornerId);
            floor.walls.push({
              id: genId('w'),
              from: c1.id,
              to: corner.id,
              length: calcDist(c1, corner)
            });
            updateStatusHint(`Стена построена: ${c1.id} ➔ ${corner.id} (${calcDist(c1, corner)} px)`);
          } else {
            updateStatusHint('Стена между этими точками уже существует!');
          }
          state.wallStartCornerId = corner.id; // Цепочка
          updateFloorUI();
        }
      }
    }

    if (state.hasDragged) {
      updateFloorUI();
    }
  }

  state.isPanning = false;
  state.isDraggingCorner = false;
  canvas.style.cursor = 'crosshair';
  render();
});

// Зум
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const worldBefore = screenToWorld(sx, sy);
  const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
  const newZoom = Math.min(Math.max(0.2, state.zoom * zoomFactor), 4.0);

  state.zoom = newZoom;
  state.pan.x = sx - worldBefore.x * state.zoom;
  state.pan.y = sy + worldBefore.y * state.zoom; // Учет инверсии оси Y

  document.getElementById('zoom-indicator').innerText = `${Math.round(state.zoom * 100)}%`;
  render();
}, { passive: false });

// Инструменты
const toolButtons = {
  corner: document.getElementById('tool-corner'),
  wall: document.getElementById('tool-wall'),
  delete: document.getElementById('tool-delete')
};

function setTool(toolName) {
  state.tool = toolName;
  state.wallStartCornerId = null;

  Object.keys(toolButtons).forEach(name => {
    if (name === toolName) {
      toolButtons[name].classList.add('active-tool');
      toolButtons[name].classList.remove('hover:bg-slate-800', 'text-slate-300');
    } else {
      toolButtons[name].classList.remove('active-tool');
      toolButtons[name].classList.add('hover:bg-slate-800', 'text-slate-300');
    }
  });

  const hints = {
    corner: 'Клик в пустоту — создать точку. Зажмите точку — перетащите её. Двойной клик — изменить.',
    wall: 'Клик по двум точкам — создать стену. Также можно зажать и двигать точки.',
    delete: 'Кликните по точке или стене для удаления.'
  };
  updateStatusHint(hints[toolName]);
  render();
}

Object.keys(toolButtons).forEach(toolName => {
  toolButtons[toolName].addEventListener('click', () => setTool(toolName));
});

function updateStatusHint(text) {
  document.getElementById('status-hint').innerHTML = `
    <i class="fa-solid fa-circle-info text-blue-400"></i>
    <span>${text}</span>
  `;
}

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  state.zoom = Math.min(4.0, state.zoom * 1.2);
  document.getElementById('zoom-indicator').innerText = `${Math.round(state.zoom * 100)}%`;
  render();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  state.zoom = Math.max(0.2, state.zoom / 1.2);
  document.getElementById('zoom-indicator').innerText = `${Math.round(state.zoom * 100)}%`;
  render();
});
document.getElementById('btn-reset-view').addEventListener('click', () => {
  state.pan = { x: 100, y: 550 };
  state.zoom = 1.0;
  document.getElementById('zoom-indicator').innerText = '100%';
  render();
});

// -------------------------------------------------------------
// ВЫБОР ЭТАЖА И СПИСКИ ВЕРШИН / СТЕН
// -------------------------------------------------------------

const floorsListEl = document.getElementById('floors-list');
const cornersListEl = document.getElementById('corners-list');
const wallsListEl = document.getElementById('walls-list');

const inputFloorName = document.getElementById('input-floor-name');
const inputFloorLevel = document.getElementById('input-floor-level');
const inputFloorHeight = document.getElementById('input-floor-height');

// Вкладки сайдбара
const tabButtons = {
  floors: document.getElementById('tab-btn-floors'),
  corners: document.getElementById('tab-btn-corners'),
  walls: document.getElementById('tab-btn-walls')
};

const tabContents = {
  floors: document.getElementById('tab-content-floors'),
  corners: document.getElementById('tab-content-corners'),
  walls: document.getElementById('tab-content-walls')
};

function switchSidebarTab(tabName) {
  Object.keys(tabButtons).forEach(name => {
    if (name === tabName) {
      tabButtons[name].className = 'sidebar-tab flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 bg-slate-800 text-white shadow-sm border border-slate-700';
      tabContents[name].classList.remove('hidden');
    } else {
      tabButtons[name].className = 'sidebar-tab flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 transition';
      tabContents[name].classList.add('hidden');
    }
  });
}

Object.keys(tabButtons).forEach(name => {
  tabButtons[name].addEventListener('click', () => switchSidebarTab(name));
});

function renderFloorsList() {
  floorsListEl.innerHTML = '';
  state.floors.sort((a, b) => b.level - a.level);

  state.floors.forEach(floor => {
    const isActive = floor.id === state.activeFloorId;
    const card = document.createElement('div');
    card.className = `p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
      isActive 
        ? 'bg-red-600/15 border-red-500 text-white shadow-sm ring-1 ring-red-500/30' 
        : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${isActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}">
          ${floor.level}
        </span>
        <div>
          <div class="text-xs font-semibold">${floor.name}</div>
          <div class="text-[10px] text-slate-400">${floor.corners.length} углов · ${floor.walls.length} стен</div>
        </div>
      </div>
      ${state.floors.length > 1 ? `
        <button class="btn-del-floor text-slate-500 hover:text-rose-400 p-1.5 rounded transition text-xs" title="Удалить этаж" data-id="${floor.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      ` : ''}
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.btn-del-floor')) return;
      state.activeFloorId = floor.id;
      state.selectedCornerId = null;
      state.hoverWallId = null;
      updateFloorUI();
      render();
    });

    const delBtn = card.querySelector('.btn-del-floor');
    if (delBtn) {
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`Удалить ${floor.name}?`)) {
          state.floors = state.floors.filter(f => f.id !== floor.id);
          if (state.activeFloorId === floor.id) {
            state.activeFloorId = state.floors[0]?.id || null;
          }
          updateFloorUI();
          render();
        }
      });
    }

    floorsListEl.appendChild(card);
  });
}

// Список вершин текущего этажа
function renderCornersList(floor) {
  cornersListEl.innerHTML = '';
  if (!floor || floor.corners.length === 0) {
    cornersListEl.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-500">
        <i class="fa-solid fa-circle-nodes text-2xl mb-2 text-slate-600 block"></i>
        Нет созданных вершин.<br>Выберите инструмент "Точка" и кликните по холсту.
      </div>
    `;
    return;
  }

  floor.corners.forEach(corner => {
    const isSelected = state.selectedCornerId === corner.id;
    const card = document.createElement('div');
    card.className = `p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
      isSelected 
        ? 'bg-amber-500/15 border-amber-500/80 text-white' 
        : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded text-[11px] border border-amber-400/20">
          ${corner.id}
        </span>
        <div class="font-mono text-[11px] text-slate-300">
          X: <span class="text-emerald-400">${corner.x}</span>, Y: <span class="text-emerald-400">${corner.y}</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn-edit-corner text-slate-400 hover:text-amber-400 p-1 rounded transition" title="Изменить координаты">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-del-corner text-slate-400 hover:text-rose-400 p-1 rounded transition" title="Удалить вершину">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      state.selectedCornerId = corner.id;
      centerOnPoint(corner.x, corner.y);
      render();
      renderCornersList(floor);
    });

    card.querySelector('.btn-edit-corner').addEventListener('click', e => {
      e.stopPropagation();
      openCornerEditModal(corner);
    });

    card.querySelector('.btn-del-corner').addEventListener('click', e => {
      e.stopPropagation();
      deleteCorner(floor, corner.id);
      render();
    });

    cornersListEl.appendChild(card);
  });
}

// Список стен текущего этажа (с отображением длины!)
function renderWallsList(floor) {
  wallsListEl.innerHTML = '';
  if (!floor || floor.walls.length === 0) {
    wallsListEl.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-500">
        <i class="fa-solid fa-draw-polygon text-2xl mb-2 text-slate-600 block"></i>
        Нет созданных стен.<br>Выберите инструмент "Стена" и соедините две точки.
      </div>
    `;
    return;
  }

  floor.walls.forEach(wall => {
    const isHovered = state.hoverWallId === wall.id;
    const c1 = floor.corners.find(c => c.id === wall.from);
    const c2 = floor.corners.find(c => c.id === wall.to);
    const lengthVal = wall.length || (c1 && c2 ? calcDist(c1, c2) : 0);

    const card = document.createElement('div');
    card.className = `p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
      isHovered 
        ? 'bg-blue-500/15 border-blue-500 text-white' 
        : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-mono font-bold text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-[10px]">
          ${wall.id}
        </span>
        <div class="flex items-center gap-1 font-mono text-[11px] text-slate-200">
          <span class="text-amber-400">${wall.from}</span>
          <i class="fa-solid fa-arrow-right text-[9px] text-slate-500"></i>
          <span class="text-amber-400">${wall.to}</span>
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <span class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-semibold px-2 py-0.5 rounded text-[11px]">
          ${lengthVal} px
        </span>
        <button class="btn-del-wall text-slate-400 hover:text-rose-400 p-1 rounded transition" title="Удалить стену">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      state.hoverWallId = wall.id;
      if (c1 && c2) {
        centerOnPoint((c1.x + c2.x) / 2, (c1.y + c2.y) / 2);
      }
      render();
      renderWallsList(floor);
    });

    card.querySelector('.btn-del-wall').addEventListener('click', e => {
      e.stopPropagation();
      deleteWall(floor, wall.id);
      render();
    });

    wallsListEl.appendChild(card);
  });
}

function centerOnPoint(wx, wy) {
  state.pan.x = canvas.width / 2 - wx * state.zoom;
  state.pan.y = canvas.height / 2 + wy * state.zoom;
}

function updateFloorUI() {
  const floor = getCurrentFloor();
  renderFloorsList();
  renderCornersList(floor);
  renderWallsList(floor);

  if (floor) {
    inputFloorName.value = floor.name;
    inputFloorLevel.value = floor.level;
    inputFloorHeight.value = floor.height;
    const badge = document.getElementById('active-floor-badge');
    if (badge) badge.innerText = floor.name;
  }
  updateStats();
}

function updateStats() {
  const floor = getCurrentFloor();
  const cCount = floor ? floor.corners.length : 0;
  const wCount = floor ? floor.walls.length : 0;

  const statCorners = document.getElementById('stat-corners');
  const statWalls = document.getElementById('stat-walls');
  const tabCornersCount = document.getElementById('tab-corners-count');
  const tabWallsCount = document.getElementById('tab-walls-count');

  if (statCorners) statCorners.innerText = cCount;
  if (statWalls) statWalls.innerText = wCount;
  if (tabCornersCount) tabCornersCount.innerText = cCount;
  if (tabWallsCount) tabWallsCount.innerText = wCount;
}

inputFloorName.addEventListener('input', e => {
  const floor = getCurrentFloor();
  if (floor) {
    floor.name = e.target.value;
    renderFloorsList();
  }
});
inputFloorLevel.addEventListener('change', e => {
  const floor = getCurrentFloor();
  if (floor) {
    floor.level = parseInt(e.target.value) || 0;
    renderFloorsList();
  }
});
inputFloorHeight.addEventListener('change', e => {
  const floor = getCurrentFloor();
  if (floor) {
    floor.height = parseFloat(e.target.value) || 3.0;
  }
});

document.getElementById('btn-add-floor').addEventListener('click', () => {
  const maxLevel = state.floors.reduce((max, f) => Math.max(max, f.level), 0);
  const nextLevel = maxLevel + 1;
  const newFloor = {
    id: `floor-${Date.now()}`,
    name: `${nextLevel} этаж`,
    level: nextLevel,
    height: 3.5,
    corners: [],
    walls: []
  };
  state.floors.push(newFloor);
  state.activeFloorId = newFloor.id;
  updateFloorUI();
  render();
});

// JSON
function exportToJSON() {
  return JSON.stringify({
    floors: state.floors
  }, null, 2);
}

document.getElementById('btn-export-json').addEventListener('click', () => {
  const jsonStr = exportToJSON();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ttk-venue-plan-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('json-file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      loadJSONData(data);
      alert('План успешно загружен!');
    } catch (err) {
      alert('Ошибка при чтении JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

function loadJSONData(data) {
  if (!data || !Array.isArray(data.floors) || data.floors.length === 0) {
    throw new Error('Некорректная структура: ожидается массив "floors"');
  }

  state.floors = data.floors.map(f => ({
    id: f.id || `floor-${Date.now()}`,
    name: f.name || 'Этаж',
    level: typeof f.level === 'number' ? f.level : 1,
    height: typeof f.height === 'number' ? f.height : 3.5,
    corners: Array.isArray(f.corners) ? f.corners : [],
    walls: Array.isArray(f.walls) ? f.walls : []
  }));

  state.activeFloorId = state.floors[0].id;
  updateFloorUI();
  render();
}

const modalJson = document.getElementById('modal-json');
const textareaJson = document.getElementById('json-editor-textarea');

document.getElementById('btn-view-json').addEventListener('click', () => {
  textareaJson.value = exportToJSON();
  modalJson.classList.remove('hidden');
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
  modalJson.classList.add('hidden');
});

document.getElementById('btn-copy-json').addEventListener('click', () => {
  navigator.clipboard.writeText(textareaJson.value).then(() => {
    alert('JSON скопирован в буфер обмена!');
  });
});

document.getElementById('btn-apply-json').addEventListener('click', () => {
  try {
    const data = JSON.parse(textareaJson.value);
    loadJSONData(data);
    modalJson.classList.add('hidden');
  } catch (err) {
    alert('Ошибка в синтаксисе JSON: ' + err.message);
  }
});

// Старт
resizeCanvas();
updateFloorUI();
setTool('select');
render();
