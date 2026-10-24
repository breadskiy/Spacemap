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
      walls: [],
      rooms: [],
      pois: [],
      panoramas: []
    }
  ],
  tool: 'corner', // 'corner' | 'wall' | 'room' | 'poi' | 'pano' | 'delete'
  selectedCornerId: null,
  selectedWallId: null,
  selectedPoiId: null,
  selectedPanoId: null,
  wallStartCornerId: null,
  hoverCornerId: null,
  hoverWallId: null,
  hoverPoiId: null,
  hoverPanoId: null,
  editingCornerId: null,

  // Логика комнат и точек интереса (POI)
  roomDraftCorners: [],
  hoverRoomId: null,
  editingRoomId: null,
  editingPoiId: null,
  newPoiCoords: { x: 0, y: 0 },

  // Отслеживание естественного перетаскивания (зажал точку/POI/панораму и потянул)
  dragStartMouse: { x: 0, y: 0 },
  hasDragged: false,
  isDraggingPoi: false,
  isDraggingPano: false,

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
  if (container) {
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
  }
  render();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', resizeCanvas);
window.addEventListener('load', resizeCanvas);
if (window.ResizeObserver && container) {
  new ResizeObserver(resizeCanvas).observe(container);
}

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
function render(autoSave = true) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  // 1. Координатная декартова сетка
  drawCartesianGrid();

  const floor = getCurrentFloor();
  if (floor) {
    // 2. Комнаты и зоны
    drawRooms(floor);

    // 2.1. Предпросмотр создаваемой комнаты
    drawRoomDraft(floor);

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

    // 6. Точки интереса (POI)
    drawPois(floor);

    // 7. Панорамы 360°
    drawPanoramas(floor);
  }

  ctx.restore();
  updateStats();
  if (autoSave) {
    saveDraftToStorage();
  }
}

// Декартова сетка: X вправо (+), Y вверх (+)
function drawCartesianGrid() {
  const step = state.gridStep;
  const majorStep = state.majorGridStep;

  // Границы видимой области в мировых координатах
  const width = container ? container.clientWidth : canvas.width;
  const height = container ? container.clientHeight : canvas.height;
  const minX = -state.pan.x / state.zoom;
  const maxX = (width - state.pan.x) / state.zoom;
  const maxY = state.pan.y / state.zoom;
  const minY = (state.pan.y - height) / state.zoom;

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

// Вычисление центра комнаты (среднее координат её углов)
function getRoomCenter(room, floor) {
  if (!room || !Array.isArray(room.corners) || room.corners.length === 0) return { x: 0, y: 0 };
  let sumX = 0, sumY = 0, count = 0;
  room.corners.forEach(cid => {
    const c = floor.corners.find(pt => pt.id === cid);
    if (c) {
      sumX += c.x;
      sumY += c.y;
      count++;
    }
  });
  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
}

// Отрисовка комнат
function drawRooms(floor) {
  if (!floor.rooms) floor.rooms = [];

  floor.rooms.forEach(room => {
    const pts = room.corners.map(cid => floor.corners.find(c => c.id === cid)).filter(Boolean);
    if (pts.length < 3) return;

    const isHovered = state.hoverRoomId === room.id;
    const isDeleteMode = state.tool === 'delete' || state.tool === 'room';
    const baseColor = room.color || '#3b82f6';

    ctx.save();
    // 1. Полупрозрачная заливка контура комнаты
    ctx.fillStyle = isHovered && state.tool === 'delete'
      ? 'rgba(244, 63, 94, 0.25)' 
      : hexToRgba(baseColor, isHovered ? 0.25 : 0.12);

    ctx.beginPath();
    const first = worldToCanvas(pts[0].x, pts[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const p = worldToCanvas(pts[i].x, pts[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();

    // Тонкий контур зоны
    ctx.strokeStyle = isHovered && state.tool === 'delete' ? '#f43f5e' : hexToRgba(baseColor, isHovered ? 0.8 : 0.4);
    ctx.lineWidth = (isHovered ? 2.5 : 1.5) / state.zoom;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 2. Название комнаты по центру
    const center = getRoomCenter(room, floor);
    const canvasCenter = worldToCanvas(center.x, center.y);
    drawRoomBadge(room.name, canvasCenter.x, canvasCenter.y, baseColor, isHovered);
  });
}

// Бейдж с названием комнаты
function drawRoomBadge(text, x, y, color, isHovered) {
  ctx.save();
  const fontSize = Math.max(10, 12 / state.zoom);
  ctx.font = `bold ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const paddingX = 8 / state.zoom;
  const paddingY = 4 / state.zoom;
  const badgeH = 20 / state.zoom;
  const badgeW = textWidth + paddingX * 2 + (14 / state.zoom); // с учетом иконки

  // Фон бейджа
  ctx.fillStyle = isHovered ? '#1e293b' : 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = isHovered ? '#38bdf8' : (color || '#475569');
  ctx.lineWidth = (isHovered ? 2 : 1.2) / state.zoom;

  ctx.beginPath();
  ctx.roundRect(x - badgeW / 2, y - badgeH / 2, badgeW, badgeH, 6 / state.zoom);
  ctx.fill();
  ctx.stroke();

  // Маркер цвета слева от текста
  ctx.beginPath();
  ctx.fillStyle = color || '#3b82f6';
  ctx.arc(x - badgeW / 2 + paddingX + (3 / state.zoom), y, 3.5 / state.zoom, 0, Math.PI * 2);
  ctx.fill();

  // Сам текст названия
  ctx.fillStyle = isHovered ? '#ffffff' : '#f1f5f9';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x - badgeW / 2 + paddingX + (10 / state.zoom), y);

  ctx.restore();
}

// Отрисовка черновика создаваемой комнаты
function drawRoomDraft(floor) {
  if (state.tool !== 'room' || !Array.isArray(state.roomDraftCorners) || state.roomDraftCorners.length === 0) return;

  const pts = state.roomDraftCorners.map(cid => floor.corners.find(c => c.id === cid)).filter(Boolean);
  if (pts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.5 / state.zoom;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  const first = worldToCanvas(pts[0].x, pts[0].y);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = worldToCanvas(pts[i].x, pts[i].y);
    ctx.lineTo(p.x, p.y);
  }

  // Линия к текущему курсору
  const curPos = worldToCanvas(state.mouseWorld.x, state.mouseWorld.y);
  ctx.lineTo(curPos.x, curPos.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Подсветка первого угла (для замыкания)
  ctx.beginPath();
  ctx.strokeStyle = '#22d3ee';
  ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 3 / state.zoom;
  ctx.arc(first.x, first.y, 14 / state.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function hexToRgba(hex, alpha = 0.2) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// Поиск комнаты под курсором (по клику на бейдж названия)
function findRoomAt(wx, wy, floor) {
  if (!floor || !floor.rooms) return null;
  return floor.rooms.find(room => {
    const center = getRoomCenter(room, floor);
    // Проверяем расстояние от центра бейджа названия
    const dist = Math.hypot(wx - center.x, wy - center.y);
    return dist <= (45 / state.zoom);
  });
}

function drawWalls(floor) {
  floor.walls.forEach(w => {
    const c1 = floor.corners.find(c => c.id === w.from);
    const c2 = floor.corners.find(c => c.id === w.to);
    if (!c1 || !c2) return;

    const p1 = worldToCanvas(c1.x, c1.y);
    const p2 = worldToCanvas(c2.x, c2.y);
    const isHovered = state.hoverWallId === w.id;
    const isSelected = state.selectedWallId === w.id;
    const isDeleteMode = state.tool === 'delete' || state.tool === 'wall';

    ctx.beginPath();
    ctx.strokeStyle = (isHovered || isSelected) && isDeleteMode 
      ? '#f43f5e' 
      : ((isHovered || isSelected) ? '#60a5fa' : '#cbd5e1');
    ctx.lineWidth = (isHovered || isSelected ? 6 : 4) / state.zoom;
    ctx.lineCap = 'round';
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Длина стены отображается ТОЛЬКО при наведении или клике ЛКМ!
    if (isHovered || isSelected) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      drawLengthBadge(`${w.length || calcDist(c1, c2)} px`, midX, midY, isHovered || isSelected);
    }
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

    // Номер и координаты точки отображаются ТОЛЬКО при наведении или клике ЛКМ!
    if (isHovered || isSelected) {
      drawCornerCoordsBadge(c, pos, radius, true);
    }
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

// -------------------------------------------------------------
// ТОЧКИ ИНТЕРЕСА (POI)
// -------------------------------------------------------------

// Проверка попадания точки в многоугольник (Ray-Casting Algorithm)
function isPointInPolygon(px, py, polygonPts) {
  let inside = false;
  for (let i = 0, j = polygonPts.length - 1; i < polygonPts.length; j = i++) {
    const xi = polygonPts[i].x, yi = polygonPts[i].y;
    const xj = polygonPts[j].x, yj = polygonPts[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Отрисовка точек интереса (POI)
function drawPois(floor) {
  if (!floor.pois) floor.pois = [];

  floor.pois.forEach(poi => {
    const pos = worldToCanvas(poi.x, poi.y);
    const isSelected = state.selectedPoiId === poi.id;
    const isHovered = state.hoverPoiId === poi.id;
    const radius = (isSelected || isHovered ? 9 : 7) / state.zoom;

    ctx.save();

    // Тень маркера
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + 2 / state.zoom, radius + 2 / state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Основной маркер точки интереса
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected || isHovered ? '#f43f5e' : '#fb7185';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = (isSelected || isHovered ? 2.5 : 2) / state.zoom;
    ctx.fill();
    ctx.stroke();

    // Белая точка внутри
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Плашка с названием точки интереса (всегда видна или при выделении)
    // Плашка с названием POI показывается ТОЛЬКО при наведении
    if (isHovered) {
      drawPoiBadge(poi, pos, radius, floor, true);
    }

    ctx.restore();
  });
}

// Бейдж названия точки интереса
function drawPoiBadge(poi, pos, radius, floor, isHighlight) {
  ctx.save();
  const room = floor.rooms ? floor.rooms.find(r => r.id === poi.room_id) : null;
  const roomName = room ? ` (${room.name})` : '';
  const fullText = poi.name;

  const fontSize = Math.max(9, 11 / state.zoom);
  ctx.font = `600 ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(fullText).width;
  const paddingX = 6 / state.zoom;
  const badgeH = 16 / state.zoom;
  const badgeW = textWidth + paddingX * 2;

  const bx = pos.x;
  const by = pos.y - radius - (10 / state.zoom);

  ctx.fillStyle = isHighlight ? '#1e293b' : 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = isHighlight ? '#fb7185' : '#475569';
  ctx.lineWidth = 1 / state.zoom;

  ctx.beginPath();
  ctx.roundRect(bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4 / state.zoom);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isHighlight ? '#fecdd3' : '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fullText, bx, by);

  ctx.restore();
}

// Поиск точки интереса под курсором
function findPoiAt(wx, wy, floor, threshold = 14 / state.zoom) {
  if (!floor || !floor.pois) return null;
  return floor.pois.find(p => Math.hypot(p.x - wx, p.y - wy) <= threshold);
}

// Отрисовка панорам 360°
function drawPanoramas(floor) {
  if (!floor.panoramas) floor.panoramas = [];

  floor.panoramas.forEach(pano => {
    const pos = worldToCanvas(pano.x, pano.y);
    const isSelected = state.selectedPanoId === pano.id;
    const isHovered = state.hoverPanoId === pano.id;
    const radius = (isSelected || isHovered ? 12 : 10) / state.zoom;

    ctx.save();

    // Внешнее свечение при наведении или выборе
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 4 / state.zoom, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.fill();
    }

    // Тень маркера
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + 2 / state.zoom, radius + 1 / state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Основное тело маркера камеры (индиго)
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected || isHovered ? '#6366f1' : '#4f46e5';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = (isSelected || isHovered ? 2.5 : 2) / state.zoom;
    ctx.fill();
    ctx.stroke();

    // Иконка камеры / объектива внутри
    const lensR = radius * 0.45;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, lensR, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 / state.zoom;
    ctx.fill();
    ctx.stroke();

    // Блик на линзе объектива
    ctx.beginPath();
    ctx.arc(pos.x - lensR * 0.35, pos.y - lensR * 0.35, lensR * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#a5b4fc';
    ctx.fill();

    // Названия панорам полностью убраны по запросу

    ctx.restore();
  });
}

// Бейдж названия панорамы
function drawPanoBadge(pano, pos, radius, floor, isHighlight) {
  ctx.save();
  const room = floor.rooms ? floor.rooms.find(r => r.id === pano.room_id) : null;
  const roomName = room ? ` [${room.name}]` : '';
  const fullText = `📷 ${pano.name}${roomName}`;

  const fontSize = Math.max(9, 11 / state.zoom);
  ctx.font = `600 ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(fullText).width;
  const paddingX = 6 / state.zoom;
  const badgeH = 16 / state.zoom;
  const badgeW = textWidth + paddingX * 2;

  const bx = pos.x;
  const by = pos.y - radius - (10 / state.zoom);

  ctx.fillStyle = isHighlight ? '#1e1b4b' : 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = isHighlight ? '#818cf8' : '#475569';
  ctx.lineWidth = 1 / state.zoom;

  ctx.beginPath();
  ctx.roundRect(bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4 / state.zoom);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isHighlight ? '#c7d2fe' : '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fullText, bx, by);

  ctx.restore();
}

// Поиск панорамы под курсором
function findPanoAt(wx, wy, floor, threshold = 16 / state.zoom) {
  if (!floor || !floor.panoramas) return null;
  return floor.panoramas.find(p => Math.hypot(p.x - wx, p.y - wy) <= threshold);
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
  const clickedRoom = findRoomAt(world.x, world.y, floor);
  const clickedPoi = findPoiAt(world.x, world.y, floor);
  const clickedPano = findPanoAt(world.x, world.y, floor);

  // Сброс предыдущих выделений
  state.selectedWallId = null;

  // Режим УДАЛЕНИЯ
  if (state.tool === 'delete') {
    if (clickedCorner) {
      deleteCorner(floor, clickedCorner.id);
    } else if (clickedWall) {
      deleteWall(floor, clickedWall.id);
    } else if (clickedRoom) {
      deleteRoom(floor, clickedRoom.id);
    } else if (clickedPoi) {
      deletePoi(floor, clickedPoi.id);
    } else if (clickedPano) {
      deletePano(floor, clickedPano.id);
    }
    render();
    return;
  }

  // Режим КОМНАТА: выбор углов контура
  if (state.tool === 'room') {
    if (clickedCorner) {
      if (state.roomDraftCorners.length === 0) {
        state.roomDraftCorners.push(clickedCorner.id);
        updateStatusHint(`Начало контура комнаты в [${clickedCorner.id}]. Кликайте по остальным углам контура.`);
      } else {
        const firstCornerId = state.roomDraftCorners[0];
        // Если кликнули по начальной точке -> ЗАМЫКАНИЕ КОНТУРА!
        if (clickedCorner.id === firstCornerId) {
          if (state.roomDraftCorners.length >= 3) {
            const finalCorners = [...state.roomDraftCorners];
            state.roomDraftCorners = [];
            openRoomEditModal(null, finalCorners);
          } else {
            updateStatusHint('Для создания комнаты нужно минимум 3 угла!');
          }
        } else {
          // Добавление следующего угла
          if (!state.roomDraftCorners.includes(clickedCorner.id)) {
            state.roomDraftCorners.push(clickedCorner.id);
            updateStatusHint(`Контур: ${state.roomDraftCorners.join(' ➔ ')}. Кликните по [${firstCornerId}] для замыкания комнаты.`);
          }
        }
      }
      render();
      return;
    } else if (clickedRoom) {
      state.hoverRoomId = clickedRoom.id;
      updateStatusHint(`Комната "${clickedRoom.name}". Двойной клик — изменить название.`);
      render();
      return;
    }
  }

  // Режим ТОЧКА ИНТЕРЕСА (POI)
  if (state.tool === 'poi') {
    if (clickedPoi) {
      state.selectedPoiId = clickedPoi.id;
      state.isDraggingPoi = true;
      state.dragStartMouse = { x: sx, y: sy };
      state.hasDragged = false;
      updateStatusHint(`Точка интереса "${clickedPoi.name}". Зажмите и тяните для перемещения.`);
      render();
      return;
    } else {
      // Клик по холсту — создать новую точку интереса
      openPoiEditModal(null, snap(world.x), snap(world.y));
      render();
      return;
    }
  }

  // Режим ПАНОРАМА 360°
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
  }

  // Если нажали на панораму в обычном режиме
  if (clickedPano) {
    state.selectedPanoId = clickedPano.id;
    state.selectedCornerId = null;
    state.selectedPoiId = null;
    state.isDraggingPano = true;
    state.dragStartMouse = { x: sx, y: sy };
    state.hasDragged = false;
    updateStatusHint(`Панорама "${clickedPano.name}". Зажмите и тяните для перемещения. Двойной клик — просмотр 360°.`);
    render();
    return;
  }

  // Если нажали на точку интереса в обычном режиме
  if (clickedPoi) {
    state.selectedPoiId = clickedPoi.id;
    state.selectedPanoId = null;
    state.selectedCornerId = null;
    state.isDraggingPoi = true;
    state.dragStartMouse = { x: sx, y: sy };
    state.hasDragged = false;
    updateStatusHint(`Точка интереса "${clickedPoi.name}". Двойной клик — редактировать.`);
    render();
    return;
  }

  // Если нажали на существующий угол — активируем готовность к перетаскиванию
  if (clickedCorner) {
    state.selectedCornerId = clickedCorner.id;
    state.selectedPoiId = null;
    state.isDraggingCorner = true;
    state.dragStartMouse = { x: sx, y: sy };
    state.hasDragged = false;
    canvas.style.cursor = 'grabbing';
    updateStatusHint(`Точка [${clickedCorner.id}] (${clickedCorner.x}, ${clickedCorner.y}): зажмите и тяните для перемещения.`);
  } else if (clickedWall) {
    // Нажатие по стене — выделяем ее и показываем длину
    state.selectedWallId = clickedWall.id;
    state.selectedCornerId = null;
    state.selectedPoiId = null;
    const c1 = floor.corners.find(c => c.id === clickedWall.from);
    const c2 = floor.corners.find(c => c.id === clickedWall.to);
    const len = clickedWall.length || (c1 && c2 ? calcDist(c1, c2) : 0);
    updateStatusHint(`Стена ${clickedWall.from} ➔ ${clickedWall.to}: длина ${len} px`);
  } else {
    // Нажатие в пустое место
    state.selectedCornerId = null;
    state.selectedWallId = null;
    state.selectedPoiId = null;

    if (state.tool === 'select') {
      state.isPanning = true;
      state.panStart = { x: sx - state.pan.x, y: sy - state.pan.y };
      canvas.style.cursor = 'grabbing';
      render();
      return;
    } else if (state.tool === 'corner') {
      const targetX = snap(world.x);
      const targetY = snap(world.y);
      openCornerCreateModal(targetX, targetY);
    } else if (state.tool === 'wall') {
      state.wallStartCornerId = null;
      updateStatusHint('Кликните по начальной точке стены');
    } else if (state.tool === 'room') {
      if (state.roomDraftCorners.length > 0) {
        state.roomDraftCorners = [];
        updateStatusHint('Выбор контура комнаты сброшен.');
      }
    }

    // Панорамирование холста при зажатии пустого места
    state.isPanning = true;
    state.panStart = { x: sx - state.pan.x, y: sy - state.pan.y };
  }

  render();
});

// ПКМ: Удаление точек, стен и комнат
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedCorner = findCornerAt(world.x, world.y);
  const clickedWall = findWallAt(world.x, world.y);
  const clickedRoom = findRoomAt(world.x, world.y, floor);
  const clickedPoi = findPoiAt(world.x, world.y, floor);
  const clickedPano = findPanoAt(world.x, world.y, floor);

  if (state.tool === 'room') {
    if (state.roomDraftCorners.length > 0) {
      state.roomDraftCorners = [];
      updateStatusHint('Создание комнаты отменено.');
      render();
      return;
    }
    if (clickedRoom) {
      deleteRoom(floor, clickedRoom.id);
      render();
      return;
    }
  }

  if (state.tool === 'poi' && clickedPoi) {
    deletePoi(floor, clickedPoi.id);
    render();
    return;
  }

  if (state.tool === 'pano' && clickedPano) {
    deletePano(floor, clickedPano.id);
    render();
    return;
  }

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

  // Общее удаление при ПКМ
  if (clickedPano) {
    deletePano(floor, clickedPano.id);
  } else if (clickedPoi) {
    deletePoi(floor, clickedPoi.id);
  } else if (clickedCorner) {
    deleteCorner(floor, clickedCorner.id);
  } else if (clickedWall) {
    deleteWall(floor, clickedWall.id);
  } else if (clickedRoom) {
    deleteRoom(floor, clickedRoom.id);
  }
  render();
});

function deleteCorner(floor, cornerId) {
  floor.corners = floor.corners.filter(c => c.id !== cornerId);
  floor.walls = floor.walls.filter(w => w.from !== cornerId && w.to !== cornerId);
  if (floor.rooms) {
    floor.rooms.forEach(r => {
      r.corners = r.corners.filter(cid => cid !== cornerId);
    });
    floor.rooms = floor.rooms.filter(r => r.corners.length >= 3);
  }
  if (state.selectedCornerId === cornerId) state.selectedCornerId = null;
  if (state.wallStartCornerId === cornerId) state.wallStartCornerId = null;
  updateFloorUI();
  updateStatusHint(`Точка ${cornerId} удалена.`);
}

function deleteWall(floor, wallId) {
  floor.walls = floor.walls.filter(w => w.id !== wallId);
  if (state.selectedWallId === wallId) state.selectedWallId = null;
  updateFloorUI();
  updateStatusHint(`Стена удалена.`);
}

function deleteRoom(floor, roomId) {
  if (!floor.rooms) return;
  const r = floor.rooms.find(rm => rm.id === roomId);
  const name = r ? r.name : roomId;
  floor.rooms = floor.rooms.filter(rm => rm.id !== roomId);
  if (state.hoverRoomId === roomId) state.hoverRoomId = null;
  updateFloorUI();
  updateStatusHint(`Комната "${name}" удалена.`);
}

function deletePoi(floor, poiId) {
  if (!floor.pois) return;
  const p = floor.pois.find(poi => poi.id === poiId);
  const name = p ? p.name : poiId;
  floor.pois = floor.pois.filter(poi => poi.id !== poiId);
  if (state.selectedPoiId === poiId) state.selectedPoiId = null;
  if (state.hoverPoiId === poiId) state.hoverPoiId = null;
  updateFloorUI();
  updateStatusHint(`Точка интереса "${name}" удалена.`);
}

function deletePano(floor, panoId) {
  if (!floor.panoramas) return;
  const p = floor.panoramas.find(pano => pano.id === panoId);
  const name = p ? p.name : panoId;
  floor.panoramas = floor.panoramas.filter(pano => pano.id !== panoId);
  if (state.selectedPanoId === panoId) state.selectedPanoId = null;
  if (state.hoverPanoId === panoId) state.hoverPanoId = null;
  updateFloorUI();
  updateStatusHint(`Панорама "${name}" удалена.`);
}

// ДВОЙНОЙ КЛИК: Редактирование точки, комнаты или POI
canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedPano = findPanoAt(world.x, world.y, floor);
  if (clickedPano) {
    if (panoClickTimeout) {
      clearTimeout(panoClickTimeout);
      panoClickTimeout = null;
    }
    closePanoViewerModal();
    openPanoEditModal(clickedPano);
    return;
  }

  const clickedPoi = findPoiAt(world.x, world.y, floor);
  if (clickedPoi) {
    openPoiEditModal(clickedPoi);
    return;
  }

  const clickedRoom = findRoomAt(world.x, world.y, floor);
  if (clickedRoom) {
    openRoomEditModal(clickedRoom);
    return;
  }

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
  modalCornerCreate.style.display = 'flex';
  modalCornerCreate.classList.remove('hidden');
  inputCreateX.focus();
  inputCreateX.select();
}

function closeCornerCreateModal() {
  modalCornerCreate.style.display = 'none';
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

  closeCornerCreateModal();
  updateFloorUI();
  render();
  updateStatusHint(`Создана точка ${newCorner.id} (${newCorner.x}, ${newCorner.y})`);
});

// -------------------------------------------------------------
// МОДАЛЬНОЕ ОКНО ТОЧКИ ИНТЕРЕСА (POI)
// -------------------------------------------------------------
const modalPoiEdit = document.getElementById('modal-poi-edit');
const formEditPoi = document.getElementById('form-edit-poi');
const inputPoiName = document.getElementById('input-poi-name');
const selectPoiRoom = document.getElementById('select-poi-room');
const selectPoiCategory = document.getElementById('select-poi-category');
const labelPoiCoords = document.getElementById('label-poi-coords');
const titleModalPoi = document.getElementById('title-modal-poi');

function openPoiEditModal(poi = null, defX = 0, defY = 0) {
  const floor = getCurrentFloor();
  if (!floor) return;

  // Заполняем выпадающий список комнат этажа
  selectPoiRoom.innerHTML = '';
  if (!floor.rooms || floor.rooms.length === 0) {
    alert('Сначала создайте хотя бы одну комнату, чтобы привязать к ней точку интереса!');
    setTool('room');
    return;
  }

  // Автоматический поиск комнаты, в которую кликнули
  let detectedRoomId = null;
  floor.rooms.forEach(room => {
    const pts = room.corners.map(cid => floor.corners.find(c => c.id === cid)).filter(Boolean);
    if (pts.length >= 3 && isPointInPolygon(defX, defY, pts)) {
      detectedRoomId = room.id;
    }
    const opt = document.createElement('option');
    opt.value = room.id;
    opt.innerText = room.name;
    selectPoiRoom.appendChild(opt);
  });

  if (poi) {
    state.editingPoiId = poi.id;
    state.newPoiCoords = { x: poi.x, y: poi.y };
    titleModalPoi.innerText = 'Редактирование точки интереса';
    inputPoiName.value = poi.name;
    selectPoiRoom.value = poi.room_id || floor.rooms[0].id;
    selectPoiCategory.value = poi.category || 'stand';
    labelPoiCoords.innerText = `X: ${poi.x}, Y: ${poi.y}`;
  } else {
    state.editingPoiId = null;
    state.newPoiCoords = { x: defX, y: defY };
    titleModalPoi.innerText = 'Новая точка интереса (POI)';
    inputPoiName.value = '';
    selectPoiRoom.value = detectedRoomId || floor.rooms[0].id;
    selectPoiCategory.value = 'stand';
    labelPoiCoords.innerText = `X: ${defX}, Y: ${defY}`;
  }

  modalPoiEdit.style.display = 'flex';
  modalPoiEdit.classList.remove('hidden');
  inputPoiName.focus();
}

function closePoiEditModal() {
  modalPoiEdit.style.display = 'none';
  modalPoiEdit.classList.add('hidden');
  state.editingPoiId = null;
}

document.getElementById('btn-close-poi-modal').addEventListener('click', closePoiEditModal);
document.getElementById('btn-cancel-poi-modal').addEventListener('click', closePoiEditModal);

formEditPoi.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor) return;
  if (!floor.pois) floor.pois = [];

  const name = inputPoiName.value.trim() || 'Без названия';
  const roomId = selectPoiRoom.value;
  const category = selectPoiCategory.value;

  if (state.editingPoiId) {
    const existing = floor.pois.find(p => p.id === state.editingPoiId);
    if (existing) {
      existing.name = name;
      existing.room_id = roomId;
      existing.category = category;
    }
  } else {
    const newPoi = {
      id: genId('poi'),
      name: name,
      category: category,
      room_id: roomId,
      x: state.newPoiCoords.x,
      y: state.newPoiCoords.y
    };
    floor.pois.push(newPoi);
    state.selectedPoiId = newPoi.id;
  }

  closePoiEditModal();
  updateFloorUI();
  render();
  updateStatusHint(`Точка интереса "${name}" сохранена!`);
});

// Закрытие модальных окон по Esc
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCornerCreateModal();
    closeCornerEditModal();
    closeRoomEditModal();
    closePoiEditModal();
    closePanoHelpModal();
    closePanoEditModal();
    closePanoViewerModal();
    modalJson.style.display = 'none'; modalJson.classList.add('hidden');
  }
});

// -------------------------------------------------------------
// МОДАЛЬНОЕ ОКНО СОЗДАНИЯ И РЕДАКТИРОВАНИЯ КОМНАТЫ
// -------------------------------------------------------------
const modalRoomEdit = document.getElementById('modal-room-edit');
const formEditRoom = document.getElementById('form-edit-room');
const inputRoomName = document.getElementById('input-room-name');
const inputRoomColor = document.getElementById('input-room-color');
const labelRoomCorners = document.getElementById('label-room-corners');
const titleModalRoom = document.getElementById('title-modal-room');
let activeDraftCorners = [];

function openRoomEditModal(room = null, cornerIds = []) {
  if (room) {
    state.editingRoomId = room.id;
    activeDraftCorners = room.corners;
    titleModalRoom.innerText = 'Редактирование названия комнаты';
    inputRoomName.value = room.name;
    inputRoomColor.value = room.color || '#3b82f6';
    labelRoomCorners.innerText = room.corners.join(', ');
  } else {
    state.editingRoomId = null;
    activeDraftCorners = cornerIds;
    titleModalRoom.innerText = 'Создание новой комнаты / зоны';
    inputRoomName.value = '';
    inputRoomColor.value = '#3b82f6';
    labelRoomCorners.innerText = cornerIds.join(', ');
  }

  document.querySelectorAll('#room-color-presets button').forEach(btn => {
    if (btn.dataset.color === inputRoomColor.value) {
      btn.classList.add('ring-2', 'ring-white');
    } else {
      btn.classList.remove('ring-2', 'ring-white');
    }
  });

  modalRoomEdit.style.display = 'flex';
  modalRoomEdit.classList.remove('hidden');
  inputRoomName.focus();
}

function closeRoomEditModal() {
  modalRoomEdit.style.display = 'none';
  modalRoomEdit.classList.add('hidden');
  state.editingRoomId = null;
  activeDraftCorners = [];
}

document.querySelectorAll('#room-color-presets button').forEach(btn => {
  btn.addEventListener('click', () => {
    inputRoomColor.value = btn.dataset.color;
    document.querySelectorAll('#room-color-presets button').forEach(b => b.classList.remove('ring-2', 'ring-white'));
    btn.classList.add('ring-2', 'ring-white');
  });
});

document.getElementById('btn-close-room-modal').addEventListener('click', closeRoomEditModal);
document.getElementById('btn-cancel-room-modal').addEventListener('click', closeRoomEditModal);

formEditRoom.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor) return;
  if (!floor.rooms) floor.rooms = [];

  const name = inputRoomName.value.trim() || 'Без названия';
  const color = inputRoomColor.value || '#3b82f6';

  if (state.editingRoomId) {
    const existing = floor.rooms.find(r => r.id === state.editingRoomId);
    if (existing) {
      existing.name = name;
      existing.color = color;
    }
  } else {
    const newRoom = {
      id: genId('room'),
      name: name,
      corners: activeDraftCorners,
      color: color
    };
    floor.rooms.push(newRoom);
    state.hoverRoomId = newRoom.id;
  }

  closeRoomEditModal();
  updateFloorUI();
  render();
  updateStatusHint(`Комната "${name}" сохранена!`);
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
  modalCornerEdit.style.display = 'flex';
  modalCornerEdit.classList.remove('hidden');
  inputCornerX.focus();
  inputCornerX.select();
}

function closeCornerEditModal() {
  modalCornerEdit.style.display = 'none';
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
    } else if (state.isDraggingPoi && state.selectedPoiId && floor.pois) {
      const mouseDist = Math.hypot(sx - state.dragStartMouse.x, sy - state.dragStartMouse.y);
      if (mouseDist > 3) {
        state.hasDragged = true;
      }

      const poi = floor.pois.find(p => p.id === state.selectedPoiId);
      if (poi) {
        poi.x = snap(world.x);
        poi.y = snap(world.y);
      }
    } else if (state.isDraggingPano && state.selectedPanoId && floor.panoramas) {
      const mouseDist = Math.hypot(sx - state.dragStartMouse.x, sy - state.dragStartMouse.y);
      if (mouseDist > 3) {
        state.hasDragged = true;
      }

      const pano = floor.panoramas.find(p => p.id === state.selectedPanoId);
      if (pano) {
        pano.x = snap(world.x);
        pano.y = snap(world.y);
      }
    }

    state.hoverCornerId = findCornerAt(world.x, world.y)?.id || null;
    state.hoverWallId = findWallAt(world.x, world.y)?.id || null;
    state.hoverPoiId = findPoiAt(world.x, world.y, floor)?.id || null;
    if (state.tool === 'select' && !state.isPanning) {
      const isOverObj = state.hoverCornerId || state.hoverWallId || state.hoverPoiId || state.hoverPanoId;
      canvas.style.cursor = isOverObj ? 'pointer' : 'grab';
    }
    state.hoverPanoId = findPanoAt(world.x, world.y, floor)?.id || null;
  }

  render();
});

window.addEventListener('mouseup', () => {
  const floor = getCurrentFloor();

  if (state.isDraggingPano) {
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
  }

  if (state.isDraggingPoi) {
    state.isDraggingPoi = false;
    updateFloorUI();
  }

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
  canvas.style.cursor = state.tool === 'select' ? 'grab' : 'crosshair';
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
  select: document.getElementById('tool-select'),
  corner: document.getElementById('tool-corner'),
  wall: document.getElementById('tool-wall'),
  room: document.getElementById('tool-room'),
  poi: document.getElementById('tool-poi'),
  pano: document.getElementById('tool-pano'),
  delete: document.getElementById('tool-delete')
};

function setTool(toolName) {
  state.tool = toolName;
  state.wallStartCornerId = null;
  state.roomDraftCorners = [];

  Object.keys(toolButtons).forEach(name => {
    if (toolButtons[name]) {
      if (name === toolName) {
        toolButtons[name].classList.add('active-tool');
        toolButtons[name].classList.remove('hover:bg-slate-800', 'text-slate-300');
      } else {
        toolButtons[name].classList.remove('active-tool');
        toolButtons[name].classList.add('hover:bg-slate-800', 'text-slate-300');
      }
    }
  });

  const hints = {
    select: 'Курсор: зажмите левую кнопку в пустом месте для перемещения по карте. Кликайте на объекты для выбора.',
    corner: 'Клик в пустоту — создать точку. Зажмите точку — перетащите её. Двойной клик — изменить.',
    wall: 'Клик по двум точкам — создать стену. Клик по стене показывает её длину.',
    room: 'Кликайте по углам по кругу, затем кликните по начальной точке, чтобы замкнуть комнату.',
    poi: 'Кликните внутри комнаты на холсте, чтобы поставить точку интереса (POI).',
    pano: 'Кликните внутри комнаты для создания панорамы 360°, или по иконке 📷 для просмотра.',
    delete: 'Кликните по точке, стене, комнате, POI или панораме для удаления.'
  };
  updateStatusHint(hints[toolName] || 'Выберите инструмент');
  if (canvas) {
    canvas.style.cursor = toolName === 'select' ? 'grab' : 'crosshair';
  }
  render();
}

Object.keys(toolButtons).forEach(toolName => {
  if (toolButtons[toolName]) {
    toolButtons[toolName].addEventListener('click', () => setTool(toolName));
  }
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
const roomsListEl = document.getElementById('rooms-list');
const poisListEl = document.getElementById('pois-list');
const panosListEl = document.getElementById('panos-list');

const inputFloorName = document.getElementById('input-floor-name');
const inputFloorLevel = document.getElementById('input-floor-level');
const inputFloorHeight = document.getElementById('input-floor-height');

// Вкладки сайдбара
const tabButtons = {
  floors: document.getElementById('tab-btn-floors'),
  corners: document.getElementById('tab-btn-corners'),
  walls: document.getElementById('tab-btn-walls'),
  rooms: document.getElementById('tab-btn-rooms'),
  panos: document.getElementById('tab-btn-panos')
};

const tabContents = {
  floors: document.getElementById('tab-content-floors'),
  corners: document.getElementById('tab-content-corners'),
  walls: document.getElementById('tab-content-walls'),
  rooms: document.getElementById('tab-content-rooms'),
  panos: document.getElementById('tab-content-panos')
};

function switchSidebarTab(tabName) {
  Object.keys(tabButtons).forEach(name => {
    const btn = tabButtons[name];
    const content = tabContents[name];
    if (!btn || !content) return;
    if (name === tabName) {
      btn.className = 'sidebar-tab py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 bg-slate-800 text-white shadow-sm border border-slate-700';
      content.classList.remove('hidden');
    } else {
      btn.className = 'sidebar-tab py-1.5 px-1 rounded-lg font-medium flex items-center justify-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800/50 transition';
      content.classList.add('hidden');
    }
  });
}

Object.keys(tabButtons).forEach(name => {
  const btn = tabButtons[name];
  if (btn) {
    btn.addEventListener('click', () => switchSidebarTab(name));
  }
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

// Список комнат и зон текущего этажа
function renderRoomsList(floor) {
  if (!roomsListEl) return;
  roomsListEl.innerHTML = '';
  if (!floor || !floor.rooms || floor.rooms.length === 0) {
    roomsListEl.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-500">
        <i class="fa-solid fa-vector-square text-2xl mb-2 text-slate-600 block"></i>
        Нет созданных комнат.<br>Выберите инструмент "Комната" и кликните по углам по кругу.
      </div>
    `;
    return;
  }

  floor.rooms.forEach(room => {
    const isHovered = state.hoverRoomId === room.id;
    const color = room.color || '#3b82f6';
    const card = document.createElement('div');
    card.className = `p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
      isHovered 
        ? 'bg-cyan-500/15 border-cyan-500 text-white' 
        : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20" style="background-color: ${color}"></span>
        <div>
          <div class="font-semibold text-white text-[12px]">${room.name}</div>
          <div class="font-mono text-[10px] text-slate-400">Углы: ${room.corners.join(', ')}</div>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn-edit-room text-slate-400 hover:text-cyan-400 p-1 rounded transition" title="Переименовать">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-del-room text-slate-400 hover:text-rose-400 p-1 rounded transition" title="Удалить комнату">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      state.hoverRoomId = room.id;
      const center = getRoomCenter(room, floor);
      centerOnPoint(center.x, center.y);
      render();
      renderRoomsList(floor);
    });

    card.querySelector('.btn-edit-room').addEventListener('click', e => {
      e.stopPropagation();
      openRoomEditModal(room);
    });

    card.querySelector('.btn-del-room').addEventListener('click', e => {
      e.stopPropagation();
      deleteRoom(floor, room.id);
      render();
    });

    roomsListEl.appendChild(card);
  });
}

// Список точек интереса (POI) текущего этажа
function renderPoisList(floor) {
  if (!poisListEl) return;
  poisListEl.innerHTML = '';
  if (!floor || !floor.pois || floor.pois.length === 0) {
    poisListEl.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-500">
        <i class="fa-solid fa-location-dot text-2xl mb-2 text-slate-600 block"></i>
        Нет созданных точек интереса.<br>Выберите инструмент "Точка интереса" и кликните внутри комнаты.
      </div>
    `;
    return;
  }

  floor.pois.forEach(poi => {
    const isSelected = state.selectedPoiId === poi.id;
    const isHovered = state.hoverPoiId === poi.id;
    const room = floor.rooms ? floor.rooms.find(r => r.id === poi.room_id) : null;
    const roomName = room ? room.name : 'Без комнаты';

    const card = document.createElement('div');
    card.className = `p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
      isSelected || isHovered
        ? 'bg-rose-500/15 border-rose-500 text-white' 
        : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2.5">
        <i class="fa-solid fa-location-dot text-rose-500 text-sm"></i>
        <div>
          <div class="font-semibold text-white text-[12px]">${poi.name}</div>
          <div class="text-[10px] text-slate-400">
            Зона: <span class="text-cyan-400">${roomName}</span> · <span class="font-mono">(${poi.x}, ${poi.y})</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn-edit-poi text-slate-400 hover:text-rose-400 p-1 rounded transition" title="Редактировать">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-del-poi text-slate-400 hover:text-rose-400 p-1 rounded transition" title="Удалить точку">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      state.selectedPoiId = poi.id;
      centerOnPoint(poi.x, poi.y);
      render();
      renderPoisList(floor);
    });

    card.querySelector('.btn-edit-poi').addEventListener('click', e => {
      e.stopPropagation();
      openPoiEditModal(poi);
    });

    card.querySelector('.btn-del-poi').addEventListener('click', e => {
      e.stopPropagation();
      deletePoi(floor, poi.id);
      render();
    });

    poisListEl.appendChild(card);
  });
}

function centerOnPoint(wx, wy) {
  const width = container ? container.clientWidth : canvas.width;
  const height = container ? container.clientHeight : canvas.height;
  state.pan.x = width / 2 - wx * state.zoom;
  state.pan.y = height / 2 + wy * state.zoom;
}

function updateFloorUI() {
  const floor = getCurrentFloor();
  renderFloorsList();
  renderCornersList(floor);
  renderWallsList(floor);
  renderRoomsList(floor);
  renderPoisList(floor);
  renderPanosList(floor);

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
  const rCount = floor && floor.rooms ? floor.rooms.length : 0;
  const pCount = floor && floor.pois ? floor.pois.length : 0;
  const panoCount = floor && floor.panoramas ? floor.panoramas.length : 0;

  const statCorners = document.getElementById('stat-corners');
  const statWalls = document.getElementById('stat-walls');
  const statRooms = document.getElementById('stat-rooms');
  const statPois = document.getElementById('stat-pois');
  const statPanos = document.getElementById('stat-panos');
  const tabCornersCount = document.getElementById('tab-corners-count');
  const tabWallsCount = document.getElementById('tab-walls-count');
  const tabRoomsCount = document.getElementById('tab-rooms-count');
  const tabPoisCount = document.getElementById('tab-pois-count');
  const tabPanosCount = document.getElementById('tab-panos-count');

  if (statCorners) statCorners.innerText = cCount;
  if (statWalls) statWalls.innerText = wCount;
  if (statRooms) statRooms.innerText = rCount;
  if (statPois) statPois.innerText = pCount;
  if (statPanos) statPanos.innerText = panoCount;
  if (tabCornersCount) tabCornersCount.innerText = cCount;
  if (tabWallsCount) tabWallsCount.innerText = wCount;
  if (tabRoomsCount) tabRoomsCount.innerText = rCount;
  if (tabPoisCount) tabPoisCount.innerText = pCount;
  if (tabPanosCount) tabPanosCount.innerText = panoCount;
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
    walls: [],
    rooms: [],
    pois: [],
    panoramas: []
  };
  state.floors.push(newFloor);
  state.activeFloorId = newFloor.id;
  updateFloorUI();
  render();
});


// -------------------------------------------------------------
// РАБОТА С ПАНОРАМАМИ 360° (СЪЕМКА, ГИД, ИНТЕРАКТИВНЫЙ ПРОСМОТРЩИК)
// -------------------------------------------------------------

// Список панорам (360°) текущего этажа в боковой панели
function renderPanosList(floor) {
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

// =============================================================
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
const POI_CATEGORIES = {
  stand: { label: 'Стенд / Экспонат', color: '#f43f5e', icon: 'fa-cube', symbol: '🏬' },
  info: { label: 'Инфо / Ресепшн', color: '#0ea5e9', icon: 'fa-circle-info', symbol: 'ℹ️' },
  food: { label: 'Кофе / Еда / Бар', color: '#f59e0b', icon: 'fa-mug-hot', symbol: '☕' },
  wifi: { label: 'Точка Wi-Fi', color: '#10b981', icon: 'fa-wifi', symbol: '📶' },
  service: { label: 'Сервис / Услуги', color: '#a855f7', icon: 'fa-bell-concierge', symbol: '🛎️' },
  wc: { label: 'Санузел', color: '#06b6d4', icon: 'fa-restroom', symbol: '🚻' },
  entrance: { label: 'Вход / Выход', color: '#10b981', icon: 'fa-door-open', symbol: '🚪' }
};

let panoClickTimeout = null;

const panoEditorState = {
  panoId: null,
  x: 0,
  y: 0,
  imageData: null,
  fileName: null,
  width: 0,
  height: 0,
  hotspots: []
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
    panoEditorState.hotspots = Array.isArray(pano.hotspots) ? JSON.parse(JSON.stringify(pano.hotspots)) : [];

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
    panoEditorState.hotspots = [];

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

  renderPanoHotspotsList();
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
const btnModalPreview360 = document.getElementById('btn-modal-preview-360');

function triggerPreviewInViewer() {
  const floor = getCurrentFloor();
  const tempPano = {
    id: panoEditorState.panoId || 'temp_preview',
    name: inputEditPanoName.value.trim() || 'Предпросмотр 360°',
    room_id: selectEditPanoRoom.value || null,
    x: panoEditorState.x,
    y: panoEditorState.y,
    image_data: panoEditorState.imageData || null,
    hotspots: panoEditorState.hotspots
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
        existing.hotspots = panoEditorState.hotspots;
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
        hotspots: panoEditorState.hotspots,
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

// -------------------------------------------------------------
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
const iconAutorotate = document.getElementById('icon-autorotate');
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
  showHotspots: true,
  isDragging: false,
  lastX: 0,
  lastY: 0,
  animId: null
};

function openPanoViewerModal(pano) {
  const floor = getCurrentFloor();
  if (!floor) return;

  viewerState.pano = pano;
  viewerState.yaw = 0;
  viewerState.pitch = 0;
  viewerState.fov = 75;
  viewerState.autoRotate = true;
  updateAutoRotateBtn();

  const room = floor.rooms ? floor.rooms.find(r => r.id === pano.room_id) : null;
  const roomName = room ? room.name : 'Помещение';

  if (viewerPanoTitle) viewerPanoTitle.innerText = pano.name;
  if (viewerRoomBadge) viewerRoomBadge.innerText = roomName;
  if (viewerFloorBadge) viewerFloorBadge.innerText = floor.name;
  if (viewerCoordsBadge) viewerCoordsBadge.innerText = `X: ${pano.x}, Y: ${pano.y}`;

  // Загружаем панорамную текстуру
  const textureDataUrl = pano.image_data || generatePanoTexture(roomName, room ? room.color : '#3b82f6');
  const img = new Image();
  img.onload = () => {
    viewerState.textureImg = img;
    resizeViewerCanvas();
    startViewerLoop();
  };
  img.src = textureDataUrl;

  if (modalPanoViewer) { modalPanoViewer.style.display = 'flex'; modalPanoViewer.classList.remove('hidden'); }
}

function closePanoViewerModal() {
  if (modalPanoViewer) { modalPanoViewer.style.display = 'none'; modalPanoViewer.classList.add('hidden'); }
  if (viewerState.animId) {
    cancelAnimationFrame(viewerState.animId);
    viewerState.animId = null;
  }
}

if (btnCloseViewer) btnCloseViewer.addEventListener('click', closePanoViewerModal);

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
}


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

function resizeViewerCanvas() {
  if (!viewer360Canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = viewer360Canvas.parentElement.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 500;
  viewer360Canvas.width = Math.round(w * dpr);
  viewer360Canvas.height = Math.round(h * dpr);
  viewer360Canvas.style.width = w + 'px';
  viewer360Canvas.style.height = h + 'px';
}
window.addEventListener('resize', () => {
  if (modalPanoViewer && !modalPanoViewer.classList.contains('hidden')) {
    resizeViewerCanvas();
  }
});

function updateAutoRotateBtn() {
  if (!iconAutorotate) return;
  if (viewerState.autoRotate) {
    iconAutorotate.className = 'fa-solid fa-pause text-indigo-400';
  } else {
    iconAutorotate.className = 'fa-solid fa-play text-indigo-400';
  }
}

if (btnViewerAutorotate) {
  btnViewerAutorotate.addEventListener('click', () => {
    viewerState.autoRotate = !viewerState.autoRotate;
    updateAutoRotateBtn();
  });
}

if (btnViewerDownload) {
  btnViewerDownload.addEventListener('click', () => {
    if (!viewerState.textureImg) return;
    const a = document.createElement('a');
    a.href = viewerState.textureImg.src;
    const panoTitle = (viewerState.pano && viewerState.pano.name ? viewerState.pano.name : 'panorama-360').replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
    a.download = `${panoTitle}-${Date.now()}.jpg`;
    a.click();
  });
}

if (btnViewerZoomIn) {
  btnViewerZoomIn.addEventListener('click', () => {
    viewerState.fov = Math.max(40, viewerState.fov - 8);
  });
}
if (btnViewerZoomOut) {
  btnViewerZoomOut.addEventListener('click', () => {
    viewerState.fov = Math.min(95, viewerState.fov + 8);
  });
}
if (btnViewerReset) {
  btnViewerReset.addEventListener('click', () => {
    viewerState.yaw = 0;
    viewerState.pitch = 0;
    viewerState.fov = 75;
  });
}

// Управление мышью и касаниями в 360° вьювере
if (viewer360Canvas) {
  viewer360Canvas.addEventListener('mousedown', e => {
    viewerState.isDragging = true;
    viewerState.lastX = e.clientX;
    viewerState.lastY = e.clientY;
    viewerState.autoRotate = false;
    updateAutoRotateBtn();
  });

  window.addEventListener('mousemove', e => {
    if (!viewerState.isDragging) return;
    const dx = e.clientX - viewerState.lastX;
    const dy = e.clientY - viewerState.lastY;

    // Чувствительность вращения
    const sensitivity = (viewerState.fov / 75) * 0.28;
    viewerState.yaw = (viewerState.yaw - dx * sensitivity + 360) % 360;
    viewerState.pitch = Math.max(-42, Math.min(42, viewerState.pitch + dy * sensitivity));

    viewerState.lastX = e.clientX;
    viewerState.lastY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    viewerState.isDragging = false;
  });

  // Зум колесиком
  viewer360Canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.05;
    viewerState.fov = Math.max(40, Math.min(95, viewerState.fov + zoomDelta));
  }, { passive: false });

  // Тач-события для мобильных устройств
  viewer360Canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      viewerState.isDragging = true;
      viewerState.lastX = e.touches[0].clientX;
      viewerState.lastY = e.touches[0].clientY;
      viewerState.autoRotate = false;
      updateAutoRotateBtn();
    }
  }, { passive: true });

  viewer360Canvas.addEventListener('touchmove', e => {
    if (viewerState.isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - viewerState.lastX;
      const dy = e.touches[0].clientY - viewerState.lastY;
      const sensitivity = 0.25;
      viewerState.yaw = (viewerState.yaw - dx * sensitivity + 360) % 360;
      viewerState.pitch = Math.max(-42, Math.min(42, viewerState.pitch + dy * sensitivity));
      viewerState.lastX = e.touches[0].clientX;
      viewerState.lastY = e.touches[0].clientY;
    }
  }, { passive: true });

  viewer360Canvas.addEventListener('touchend', () => {
    viewerState.isDragging = false;
  });
}

// Цикл отрисовки 360° цилиндрической проекции
function startViewerLoop() {
  if (!viewer360Ctx || !viewer360Canvas) return;

  function render360() {
    if (!viewerState.textureImg) return;

    if (viewerState.autoRotate && !viewerState.isDragging) {
      viewerState.yaw = (viewerState.yaw + 0.18) % 360;
    }

    const vw = viewer360Canvas.width;
    const vh = viewer360Canvas.height;
    const img = viewerState.textureImg;

    viewer360Ctx.clearRect(0, 0, vw, vh);

    // Доля обзора по горизонтали в зависимости от fov
    const visibleRatio = viewerState.fov / 360;
    const srcVisibleWidth = img.width * visibleRatio;
    const srcCenterX = (viewerState.yaw / 360) * img.width;
    let srcX1 = srcCenterX - srcVisibleWidth / 2;

    // Смещение по вертикали (наклон pitch)
    const pitchOffset = (viewerState.pitch / 90) * (vh * 0.85);

    // Отрисовка с круговым горизонтальным зацикливанием
    if (srcX1 < 0) {
      const leftPartWidth = -srcX1;
      const leftRatio = leftPartWidth / srcVisibleWidth;
      const destSplitX = vw * leftRatio;

      viewer360Ctx.drawImage(
        img,
        img.width + srcX1, 0, leftPartWidth, img.height,
        0, pitchOffset, destSplitX, vh
      );
      viewer360Ctx.drawImage(
        img,
        0, 0, srcVisibleWidth - leftPartWidth, img.height,
        destSplitX, pitchOffset, vw - destSplitX, vh
      );
    } else if (srcX1 + srcVisibleWidth > img.width) {
      const rightPartWidth = img.width - srcX1;
      const rightRatio = rightPartWidth / srcVisibleWidth;
      const destSplitX = vw * rightRatio;

      viewer360Ctx.drawImage(
        img,
        srcX1, 0, rightPartWidth, img.height,
        0, pitchOffset, destSplitX, vh
      );
      viewer360Ctx.drawImage(
        img,
        0, 0, srcVisibleWidth - rightPartWidth, img.height,
        destSplitX, pitchOffset, vw - destSplitX, vh
      );
    } else {
      viewer360Ctx.drawImage(
        img,
        srcX1, 0, srcVisibleWidth, img.height,
        0, pitchOffset, vw, vh
      );
    }

    // Отрисовка точек интереса на 360° панораме
    // Отрисовка хотспотов в 360 панораме отключена по запросу

    // Отрисовка компаса вверху вьювера
    drawViewerCompass(viewer360Ctx, vw, vh, viewerState.yaw);

    viewerState.animId = requestAnimationFrame(render360);
  }

  if (viewerState.animId) cancelAnimationFrame(viewerState.animId);
  viewerState.animId = requestAnimationFrame(render360);
}

// Компасная лента вверху 360° экрана
function drawViewerCompass(c, vw, vh, currentYaw) {
  c.save();
  const barW = Math.min(320, vw * 0.7);
  const barH = 26;
  const barX = (vw - barW) / 2;
  const barY = 14;

  c.fillStyle = 'rgba(15, 23, 42, 0.75)';
  c.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(barX, barY, barW, barH, 13);
  c.fill();
  c.stroke();

  // Отметки сторон света
  const points = [
    { deg: 0, label: 'С' },
    { deg: 90, label: 'В' },
    { deg: 180, label: 'Ю' },
    { deg: 270, label: 'З' }
  ];

  c.font = 'bold 11px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  points.forEach(pt => {
    let diff = pt.deg - currentYaw;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;

    const posX = barX + barW / 2 + (diff / 90) * (barW / 2);
    if (posX >= barX + 10 && posX <= barX + barW - 10) {
      c.fillStyle = pt.label === 'С' ? '#ef4444' : '#ffffff';
      c.fillText(pt.label, posX, barY + barH / 2);
    }
  });

  // Центральный визир
  c.fillStyle = '#6366f1';
  c.beginPath();
  c.moveTo(barX + barW / 2, barY + barH);
  c.lineTo(barX + barW / 2 - 4, barY + barH + 5);
  c.lineTo(barX + barW / 2 + 4, barY + barH + 5);
  c.closePath();
  c.fill();

  c.restore();
}

// JSON
function exportToJSON() {
  return JSON.stringify({
    floors: state.floors
  }, null, 2);
}

// Быстрое сохранение плана прямо в проект SpaceMap
const btnSavePlanQuick = document.getElementById('btn-save-plan-quick');
if (btnSavePlanQuick) {
  btnSavePlanQuick.addEventListener('click', () => {
    saveDraftToStorage(true);
    const prevHtml = btnSavePlanQuick.innerHTML;
    btnSavePlanQuick.innerHTML = '<i class="fa-solid fa-check"></i> <span>Сохранено!</span>';
    btnSavePlanQuick.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
    btnSavePlanQuick.classList.add('bg-emerald-700');
    setTimeout(() => {
      btnSavePlanQuick.innerHTML = prevHtml;
      btnSavePlanQuick.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
      btnSavePlanQuick.classList.remove('bg-emerald-700');
    }, 1600);
  });
}

document.getElementById('btn-export-json').addEventListener('click', () => {
  saveDraftToStorage(true);
  const jsonStr = exportToJSON();

  // 1. Отправляем готовый JSON на родительский сайт (Человеку 4) через postMessage
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'PLAN_SAVED',
      payload: JSON.parse(jsonStr)
    }, '*');
    console.log('[Editor] План отправлен на родительский сайт через postMessage');
  }

  // 2. Также скачиваем локальный файл (для удобства)
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ttk-venue-plan-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Слушаем команды от родительского сайта Человека 4
window.addEventListener('message', event => {
  // Если родительский сайт прислал готовый план из базы данных:
  if (event.data && event.data.type === 'LOAD_PLAN') {
    try {
      const data = typeof event.data.payload === 'string' 
        ? JSON.parse(event.data.payload) 
        : event.data.payload;
      loadJSONData(data);
      console.log('[Editor] План успешно загружен из родительского сайта!');
    } catch (err) {
      console.error('[Editor] Ошибка загрузки плана от сайта:', err);
    }
  }
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
    walls: Array.isArray(f.walls) ? f.walls : [],
    rooms: Array.isArray(f.rooms) ? f.rooms : [],
    pois: Array.isArray(f.pois) ? f.pois : [],
    panoramas: Array.isArray(f.panoramas) ? f.panoramas : []
  }));

  state.activeFloorId = state.floors[0].id;
  updateFloorUI();
  render();
}

const modalJson = document.getElementById('modal-json');
const textareaJson = document.getElementById('json-editor-textarea');

document.getElementById('btn-view-json').addEventListener('click', () => {
  textareaJson.value = exportToJSON();
  modalJson.style.display = 'flex'; modalJson.classList.remove('hidden');
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
  modalJson.style.display = 'none'; modalJson.classList.add('hidden');
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
    modalJson.style.display = 'none'; modalJson.classList.add('hidden');
  } catch (err) {
    alert('Ошибка в синтаксисе JSON: ' + err.message);
  }
});

// Старт

// -------------------------------------------------------------
// АВТОСОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ ЧЕРНОВИКА (LOCALSTORAGE)
// -------------------------------------------------------------
// Получение spaceId из адресной строки iframe (?spaceId=...)
const urlParams = new URLSearchParams(window.location.search);
const currentSpaceId = urlParams.get('spaceId') || '';
const storagePlanKey = currentSpaceId ? ('spacemap_plan_' + currentSpaceId) : 'ttk_floor_plan_draft';

function saveDraftToStorage() {
  try {
    const jsonStr = exportToJSON();
    const hasAnyContent = state.floors && state.floors.some(f => 
      (f.corners && f.corners.length > 0) || 
      (f.walls && f.walls.length > 0) || 
      (f.rooms && f.rooms.length > 0) || 
      (f.panoramas && f.panoramas.length > 0)
    );

    if (storagePlanKey) {
      localStorage.setItem(storagePlanKey, jsonStr);
    }
    // Записываем в общий черновик ТОЛЬКО если есть реальный контент,
    // чтобы открытие чистого проекта никогда не стирало прошлую версию!
    if (hasAnyContent) {
      localStorage.setItem('ttk_floor_plan_draft', jsonStr);
    }

    // Обновляем счетчик стен в карточке объекта
    if (currentSpaceId) {
      try {
        const spacesRaw = localStorage.getItem('spacemap_venues_v2');
        if (spacesRaw) {
          const spaces = JSON.parse(spacesRaw);
          const sp = spaces.find(s => s.id === currentSpaceId);
          if (sp) {
            const floor = getCurrentFloor();
            sp.wallsCount = floor && floor.walls ? floor.walls.length : 0;
            sp.updatedAt = new Date().toLocaleString('ru-RU', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });
            localStorage.setItem('spacemap_venues_v2', JSON.stringify(spaces));
          }
        }
      } catch (_) {}
    }

    // Оповещаем родительское окно SpaceMap (React)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'SPACEMAP_PLAN_SAVED',
        spaceId: currentSpaceId,
        plan: JSON.parse(jsonStr)
      }, '*');
    }
  } catch (err) {
    console.warn('[Editor] Ошибка автосохранения плана:', err);
  }
}

function loadDraftFromStorage() {
  try {
    let saved = null;
    // 1. Сначала ищем по ключу конкретного проекта
    if (storagePlanKey) {
      saved = localStorage.getItem(storagePlanKey);
    }
    // 2. Если по ключу проекта еще нет — берем сохраненный общий черновик
    if (!saved) {
      saved = localStorage.getItem('ttk_floor_plan_draft');
    }
    // 3. Если и там нет — ищем любой сохраненный чертеж в localStorage
    if (!saved) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('spacemap_plan_')) {
          const val = localStorage.getItem(k);
          if (val && (val.includes('"walls"') || val.includes('"corners"'))) {
            saved = val;
            break;
          }
        }
      }
    }
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
          // Закрепляем за текущим проектом, чтобы он сохранялся отдельно
          if (storagePlanKey && storagePlanKey !== 'ttk_floor_plan_draft') {
            localStorage.setItem(storagePlanKey, saved);
          }
          console.log('[Editor] План для объекта ' + currentSpaceId + ' успешно загружен!');
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[Editor] Ошибка чтения плана из LocalStorage:', err);
  }
  return false;
}

// Старт приложения
resizeCanvas();
if (!loadDraftFromStorage()) {
  // Начинаем с чистого проекта: пустой этаж и только координатная сетка
  state.floors = [
    {
      id: 'floor-1',
      name: '1 этаж',
      level: 1,
      height: 3.5,
      corners: [],
      walls: [],
      rooms: [],
      pois: [],
      panoramas: []
    }
  ];
  state.activeFloorId = 'floor-1';
  updateFloorUI();
}
setTool('select');
render(false);


// -------------------------------------------------------------
// ПЕРЕКЛЮЧЕНИЕ СШИВКИ 360° ПАНОРАМ И СВОРАЧИВАНИЕ САЙДБАРА
// -------------------------------------------------------------
(function initStitchAndSidebar() {
  // 1. Сворачивание / разворачивание левой панели
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const editorSidebar = document.getElementById('editor-sidebar');
  const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');

  if (btnToggleSidebar && editorSidebar) {
    let isSidebarCollapsed = false;
    btnToggleSidebar.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isSidebarCollapsed = !isSidebarCollapsed;
      if (isSidebarCollapsed) {
        editorSidebar.style.width = '0px';
        editorSidebar.style.minWidth = '0px';
        editorSidebar.style.maxWidth = '0px';
        editorSidebar.style.overflow = 'hidden';
        editorSidebar.style.borderRight = 'none';
        btnToggleSidebar.style.left = '10px';
        if (sidebarToggleIcon) {
          sidebarToggleIcon.className = 'fa-solid fa-chevron-right text-[10px]';
        }
        btnToggleSidebar.title = 'Развернуть панель';
      } else {
        editorSidebar.style.width = '320px';
        editorSidebar.style.minWidth = '320px';
        editorSidebar.style.maxWidth = '320px';
        editorSidebar.style.overflow = '';
        editorSidebar.style.borderRight = '';
        btnToggleSidebar.style.left = '308px';
        if (sidebarToggleIcon) {
          sidebarToggleIcon.className = 'fa-solid fa-chevron-left text-[10px]';
        }
        btnToggleSidebar.title = 'Свернуть панель';
      }
      setTimeout(resizeCanvas, 50);
      setTimeout(resizeCanvas, 320);
    };
  }

  // 2. Вкладки режимов панорамы (Одиночная 360° / Сшивка из двух 180°)
  const tabPanoModeSingle = document.getElementById('tab-pano-mode-single');
  const tabPanoModeStitch = document.getElementById('tab-pano-mode-stitch');
  const panoSingleModeContainer = document.getElementById('pano-single-mode-container');
  const panoStitchModeContainer = document.getElementById('pano-stitch-mode-container');

  const inputStitchFrame1 = document.getElementById('input-stitch-frame1');
  const dropzoneStitchFrame1 = document.getElementById('dropzone-stitch-frame1');
  const stitchFrame1Name = document.getElementById('stitch-frame1-name');

  const inputStitchFrame2 = document.getElementById('input-stitch-frame2');
  const dropzoneStitchFrame2 = document.getElementById('dropzone-stitch-frame2');
  const stitchFrame2Name = document.getElementById('stitch-frame2-name');

  const btnExecuteStitch = document.getElementById('btn-execute-stitch');
  const stitchProgressIndicator = document.getElementById('stitch-progress-indicator');

  let stitchFrame1File = null;
  let stitchFrame2File = null;

  function switchPanoMode(mode) {
    if (mode === 'single') {
      if (tabPanoModeSingle) {
        tabPanoModeSingle.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition bg-indigo-600 text-white shadow cursor-pointer';
      }
      if (tabPanoModeStitch) {
        tabPanoModeStitch.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer';
      }
      if (panoSingleModeContainer) panoSingleModeContainer.classList.remove('hidden');
      if (panoStitchModeContainer) panoStitchModeContainer.classList.add('hidden');
    } else {
      if (tabPanoModeStitch) {
        tabPanoModeStitch.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition bg-indigo-600 text-white shadow cursor-pointer';
      }
      if (tabPanoModeSingle) {
        tabPanoModeSingle.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer';
      }
      if (panoSingleModeContainer) panoSingleModeContainer.classList.add('hidden');
      if (panoStitchModeContainer) panoStitchModeContainer.classList.remove('hidden');
    }
  }

  if (tabPanoModeSingle) {
    tabPanoModeSingle.onclick = (e) => { e.preventDefault(); e.stopPropagation(); switchPanoMode('single'); };
  }
  if (tabPanoModeStitch) {
    tabPanoModeStitch.onclick = (e) => { e.preventDefault(); e.stopPropagation(); switchPanoMode('stitch'); };
  }

  function updateFrameUI(num, file) {
    const dropzone = num === 1 ? dropzoneStitchFrame1 : dropzoneStitchFrame2;
    const nameBadge = num === 1 ? stitchFrame1Name : stitchFrame2Name;
    if (!dropzone) return;

    if (file) {
      if (nameBadge) nameBadge.innerText = file.name;
      dropzone.className = 'border-2 border-emerald-500/60 bg-emerald-950/20 rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 shadow-sm';
      dropzone.innerHTML = `
        <i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
        <span class="text-xs text-emerald-300 font-bold truncate max-w-[140px]">${file.name}</span>
        <span class="text-[10px] text-emerald-400/80">${(file.size / 1024 / 1024).toFixed(1)} МБ · Заменить</span>
      `;
    } else {
      if (nameBadge) nameBadge.innerText = '';
      dropzone.className = 'border-2 border-dashed border-slate-700 hover:border-indigo-400 bg-slate-950/60 rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5';
      dropzone.innerHTML = `
        <i class="fa-solid fa-camera text-slate-400 text-lg"></i>
        <span class="text-xs text-slate-300 font-medium">Выберите кадр ${num}</span>
        <span class="text-[10px] text-slate-500">HEIC или JPG</span>
      `;
    }
  }

  if (dropzoneStitchFrame1 && inputStitchFrame1) {
    dropzoneStitchFrame1.onclick = () => inputStitchFrame1.click();
    inputStitchFrame1.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        stitchFrame1File = e.target.files[0];
        updateFrameUI(1, stitchFrame1File);
      }
    };
    dropzoneStitchFrame1.ondragover = (e) => { e.preventDefault(); dropzoneStitchFrame1.classList.add('border-indigo-400'); };
    dropzoneStitchFrame1.ondragleave = () => { dropzoneStitchFrame1.classList.remove('border-indigo-400'); };
    dropzoneStitchFrame1.ondrop = (e) => {
      e.preventDefault();
      dropzoneStitchFrame1.classList.remove('border-indigo-400');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        stitchFrame1File = e.dataTransfer.files[0];
        updateFrameUI(1, stitchFrame1File);
      }
    };
  }

  if (dropzoneStitchFrame2 && inputStitchFrame2) {
    dropzoneStitchFrame2.onclick = () => inputStitchFrame2.click();
    inputStitchFrame2.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        stitchFrame2File = e.target.files[0];
        updateFrameUI(2, stitchFrame2File);
      }
    };
    dropzoneStitchFrame2.ondragover = (e) => { e.preventDefault(); dropzoneStitchFrame2.classList.add('border-indigo-400'); };
    dropzoneStitchFrame2.ondragleave = () => { dropzoneStitchFrame2.classList.remove('border-indigo-400'); };
    dropzoneStitchFrame2.ondrop = (e) => {
      e.preventDefault();
      dropzoneStitchFrame2.classList.remove('border-indigo-400');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        stitchFrame2File = e.dataTransfer.files[0];
        updateFrameUI(2, stitchFrame2File);
      }
    };
  }

  if (btnExecuteStitch) {
    btnExecuteStitch.onclick = async (e) => {
      e.preventDefault();
      if (!stitchFrame1File || !stitchFrame2File) {
        alert('Пожалуйста, выберите оба кадра по 180°:\n• Кадр 1 (первая половина комнаты)\n• Кадр 2 (вторая половина с перекрытием)');
        return;
      }

      if (stitchProgressIndicator) stitchProgressIndicator.classList.remove('hidden');
      btnExecuteStitch.disabled = true;

      try {
        const formData = new FormData();
        formData.append('frame1', stitchFrame1File);
        formData.append('frame2', stitchFrame2File);

        const response = await fetch('/api/stitch', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          let errText = 'Ошибка сервера при сшивке панорамы';
          try {
            const errJson = await response.json();
            if (errJson && errJson.message) errText = errJson.message;
          } catch (_) {}
          throw new Error(errText);
        }

        const result = await response.json();
        if (result.status === 'ok' && result.image) {
          updatePanoPreviewUI(result.image, {
            name: 'Сшитая 360° панорама (8K)',
            width: result.width || 8192,
            height: 1090,
            size: result.size
          });
          switchPanoMode('single');
        } else {
          throw new Error(result.message || 'Скрипт сшивки вернул пустой результат');
        }
      } catch (err) {
        console.error('Ошибка сшивки панорамы:', err);
        alert('Ошибка при сшивке панорамы: ' + err.message + '\n\nУбедитесь, что запущен сервер (npm run dev).');
      } finally {
        if (stitchProgressIndicator) stitchProgressIndicator.classList.add('hidden');
        btnExecuteStitch.disabled = false;
      }
    };
  }
})();
