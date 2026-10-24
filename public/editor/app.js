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
      pois: []
    }
  ],
  tool: 'corner', // 'corner' | 'wall' | 'room' | 'poi' | 'delete'
  selectedCornerId: null,
  selectedPoiId: null,
  wallStartCornerId: null,
  hoverCornerId: null,
  hoverWallId: null,
  hoverPoiId: null,
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
  majorGridStep: 100,

  // Фоновая подложка чертежа
  bgImage: null
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
  if (floor) {
    floor.corners = floor.corners || [];
    floor.walls = floor.walls || [];
    floor.pois = floor.pois || [];
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

  // 0. Фоновая подложка схемы (если загружена)
  if (state.bgImage) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(state.bgImage, 0, -state.bgImage.height);
    ctx.restore();
  }

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
        drawEscapeHintBadge("Esc или ПКМ — отпустить", curPos.x, curPos.y - (20 / state.zoom));
      }
    }

    // 5. Углы (точки)
    drawCorners(floor);

    // 6. Метки стендов и залов (POIs)
    drawPois(floor);
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

  // Числа по оси Y
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

// Поиск замкнутых циклов стен для аккуратной заливки комнат
function getWallPolygons(floor) {
  if (!floor || !floor.walls || floor.walls.length < 3 || !floor.corners || floor.corners.length < 3) return [];

  const adj = new Map();
  floor.corners.forEach(c => adj.set(c.id, []));
  floor.walls.forEach(w => {
    if (adj.has(w.from) && adj.has(w.to)) {
      if (!adj.get(w.from).includes(w.to)) adj.get(w.from).push(w.to);
      if (!adj.get(w.to).includes(w.from)) adj.get(w.to).push(w.from);
    }
  });

  const cornerMap = new Map(floor.corners.map(c => [c.id, c]));
  const foundCycles = [];
  const seenCanonical = new Set();

  function dfs(startNode, currNode, visited, path) {
    const neighbors = adj.get(currNode) || [];
    for (const next of neighbors) {
      if (path.length > 1 && next === path[path.length - 2]) continue;
      if (next === startNode && path.length >= 3) {
        const cycle = [...path];
        const canon = [...cycle].sort().join('-');
        if (!seenCanonical.has(canon)) {
          seenCanonical.add(canon);
          const pts = cycle.map(id => cornerMap.get(id)).filter(Boolean);
          if (pts.length >= 3) foundCycles.push(pts);
        }
        continue;
      }
      if (!visited.has(next) && path.length < 24) {
        visited.add(next);
        dfs(startNode, next, visited, [...path, next]);
        visited.delete(next);
      }
    }
  }

  floor.corners.forEach(c => {
    if ((adj.get(c.id) || []).length >= 2) {
      dfs(c.id, c.id, new Set([c.id]), [c.id]);
    }
  });

  return foundCycles;
}

function drawRoomFills(floor) {
  const cycles = getWallPolygons(floor);
  if (cycles.length === 0) return;

  ctx.save();
  cycles.forEach(pts => {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 1 / state.zoom;
    ctx.beginPath();
    const first = worldToCanvas(pts[0].x, pts[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const p = worldToCanvas(pts[i].x, pts[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
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

function drawEscapeHintBadge(text, x, y) {
  ctx.save();
  const fontSize = Math.max(9, 10 / state.zoom);
  ctx.font = `bold ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const paddingX = 6 / state.zoom;
  const h = 16 / state.zoom;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1 / state.zoom;

  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - paddingX, y - h / 2, textWidth + paddingX * 2, h, 4 / state.zoom);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
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

const POI_CATEGORIES = {
  stand: { label: 'Стенд / Экспозиция', color: '#ef4444', icon: '🏢' },
  expo: { label: 'Выставка / Арт', color: '#ec4899', icon: '🖼️' },
  cafe: { label: 'Кафе / Кофе-зона', color: '#f59e0b', icon: '☕' },
  food: { label: 'Фудкорт / Еда', color: '#f97316', icon: '🍔' },
  shop: { label: 'Магазин / Мерч', color: '#3b82f6', icon: '🛍️' },
  stage: { label: 'Сцена / Зал', color: '#a855f7', icon: '🎤' },
  info: { label: 'Инфостойка', color: '#06b6d4', icon: 'ℹ️' },
  exit: { label: 'Вход / Выход', color: '#10b981', icon: '🚪' },
  wc: { label: 'Туалет (WC)', color: '#64748b', icon: '🚻' },
  atm: { label: 'Банкомат', color: '#14b8a6', icon: '💳' },
  firstaid: { label: 'Медпункт', color: '#e11d48', icon: '🏥' }
};

function drawPois(floor) {
  if (!floor.pois) return;
  floor.pois.forEach(poi => {
    const pos = worldToCanvas(poi.x, poi.y);
    const isHovered = state.hoverPoiId === poi.id;
    const isSelected = state.selectedPoiId === poi.id;
    const cat = POI_CATEGORIES[poi.category] || POI_CATEGORIES.stand;

    ctx.save();
    // Внешняя метка
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (isHovered || isSelected ? 11 : 9) / state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = cat.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / state.zoom;
    ctx.fill();
    ctx.stroke();

    // Белая точка в центре
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3 / state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Бейдж с иконкой и названием
    const fontSize = Math.max(9, 10 / state.zoom);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const label = `${cat.icon} ${poi.name || cat.label}`;
    const textWidth = ctx.measureText(label).width;
    const badgeH = 16 / state.zoom;
    const badgeY = pos.y + (16 / state.zoom);

    ctx.fillStyle = isSelected || isHovered ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isSelected || isHovered ? cat.color : '#334155';
    ctx.lineWidth = 1 / state.zoom;
    ctx.beginPath();
    ctx.roundRect(pos.x - textWidth / 2 - (6 / state.zoom), badgeY - badgeH / 2, textWidth + (12 / state.zoom), badgeH, 4 / state.zoom);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pos.x, badgeY);
    ctx.restore();
  });
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

function findPoiAt(wx, wy, threshold = 15 / state.zoom) {
  const floor = getCurrentFloor();
  if (!floor || !floor.pois) return null;
  return floor.pois.find(p => Math.hypot(p.x - wx, p.y - wy) <= threshold);
}

// -------------------------------------------------------------
// ОБРАБОТЧИКИ СОБЫТИЙ МЫШИ И КЛАВИАТУРЫ
// -------------------------------------------------------------

let isSpacePressed = false;
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    isSpacePressed = true;
    canvas.style.cursor = 'grab';
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    isSpacePressed = false;
    canvas.style.cursor = 'crosshair';
  }
});

canvas.addEventListener('auxclick', e => {
  if (e.button === 1) e.preventDefault();
});

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);

  // Панорамирование колесиком мыши (e.button === 1), пробелом или Shift
  if (e.button === 1 || isSpacePressed || (e.shiftKey && state.tool !== 'wall')) {
    e.preventDefault();
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
  const clickedPoi = findPoiAt(world.x, world.y);

  if (clickedPoi) {
    if (state.tool === 'delete') {
      floor.pois = floor.pois.filter(p => p.id !== clickedPoi.id);
      updateStatusHint(`Метка «${clickedPoi.name}» удалена.`);
      updateFloorUI();
      render();
      return;
    }
    // Клик по метке открывает её редактирование
    openPoiModal(clickedPoi.x, clickedPoi.y, clickedPoi);
    return;
  }

  if (state.tool === 'delete') {
    if (clickedPoi) {
      floor.pois = floor.pois.filter(p => p.id !== clickedPoi.id);
      updateStatusHint(`Метка «${clickedPoi.name}» удалена.`);
    } else if (clickedCorner) {
      deleteCorner(floor, clickedCorner.id);
    } else if (clickedWall) {
      deleteWall(floor, clickedWall.id);
    }
    updateFloorUI();
    render();
    return;
  }

  // Режим метки (POI)
  if (state.tool === 'poi') {
    openPoiModal(snap(world.x), snap(world.y));
    return;
  }

  // Если нажали на существующую точку
  if (clickedCorner) {
    if (state.tool === 'wall') {
      if (!state.wallStartCornerId) {
        state.wallStartCornerId = clickedCorner.id;
        updateStatusHint(`Стена от точки [${clickedCorner.id}]: кликните по второй точке (Shift — ровный угол, Esc — отпустить привязку)`);
      } else if (state.wallStartCornerId === clickedCorner.id) {
        // Повторный клик по начальной точке отпускает привязку
        state.wallStartCornerId = null;
        updateStatusHint('Рисование стены завершено.');
        render();
        return;
      } else {
        const c1 = floor.corners.find(c => c.id === state.wallStartCornerId);
        const exists = floor.walls.some(w =>
          (w.from === state.wallStartCornerId && w.to === clickedCorner.id) ||
          (w.from === clickedCorner.id && w.to === state.wallStartCornerId)
        );

        if (!exists && c1) {
          floor.walls.push({
            id: genId('w'),
            from: c1.id,
            to: clickedCorner.id,
            length: calcDist(c1, clickedCorner)
          });
          updateStatusHint(`Стена построена: [${c1.id}] ➔ [${clickedCorner.id}]. Кликните дальше или Esc / ПКМ для завершения.`);
        }
        state.wallStartCornerId = clickedCorner.id; // Цепочка продолжается!
        updateFloorUI();
      }
    } else {
      state.selectedCornerId = clickedCorner.id;
      state.isDraggingCorner = true;
      state.dragStartMouse = { x: sx, y: sy };
      state.hasDragged = false;
      canvas.style.cursor = 'grabbing';
      updateStatusHint(`Точка [${clickedCorner.id}]: зажмите и тяните для перемещения.`);
    }
  } else {
    // Нажатие в пустое место
    if (state.tool === 'corner') {
      // Быстрое создание точки прямо на сетке
      const targetX = snap(world.x);
      const targetY = snap(world.y);
      const conflict = floor.corners.find(c => c.x === targetX && c.y === targetY);
      if (!conflict) {
        const newCorner = {
          id: genCornerId(floor),
          x: targetX,
          y: targetY
        };
        floor.corners.push(newCorner);
        state.selectedCornerId = newCorner.id;
        updateStatusHint(`Создана точка [${newCorner.id}] (${newCorner.x}, ${newCorner.y})`);
        updateFloorUI();
      }
    } else if (state.tool === 'wall') {
      // В режиме стены клик в пустоту сразу создает угол и тянет стену!
      let targetX = snap(world.x);
      let targetY = snap(world.y);

      // Ортогональная фиксация при Shift
      if (e.shiftKey && state.wallStartCornerId) {
        const startC = floor.corners.find(c => c.id === state.wallStartCornerId);
        if (startC) {
          if (Math.abs(targetX - startC.x) > Math.abs(targetY - startC.y)) {
            targetY = startC.y;
          } else {
            targetX = startC.x;
          }
        }
      }

      const newCorner = {
        id: genCornerId(floor),
        x: targetX,
        y: targetY
      };
      floor.corners.push(newCorner);

      if (!state.wallStartCornerId) {
        state.wallStartCornerId = newCorner.id;
        updateStatusHint(`Стена начата от точки [${newCorner.id}]. Кликните следующую точку (Esc — закончить).`);
      } else {
        const c1 = floor.corners.find(c => c.id === state.wallStartCornerId);
        if (c1) {
          floor.walls.push({
            id: genId('w'),
            from: c1.id,
            to: newCorner.id,
            length: calcDist(c1, newCorner)
          });
          updateStatusHint(`Стена построена. Кликните для следующей стены или Esc для завершения.`);
        }
        state.wallStartCornerId = newCorner.id; // Цепочка продолжается!
      }
      updateFloorUI();
    } else {
      // Панорамирование холста при зажатии пустого места
      state.selectedCornerId = null;
      state.isPanning = true;
      state.panStart = { x: sx - state.pan.x, y: sy - state.pan.y };
    }
  }

  render();
});

// ПКМ: сброс цепочки стены или удаление
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();

  if (state.tool === 'wall' && state.wallStartCornerId) {
    state.wallStartCornerId = null;
    updateStatusHint('Рисование стены завершено.');
    render();
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedCorner = findCornerAt(world.x, world.y);
  const clickedWall = findWallAt(world.x, world.y);
  const clickedPoi = findPoiAt(world.x, world.y);

  if (clickedPoi) {
    floor.pois = floor.pois.filter(p => p.id !== clickedPoi.id);
    updateFloorUI();
    render();
    return;
  }

  if (state.tool === 'corner' || state.tool === 'select') {
    if (clickedCorner) {
      deleteCorner(floor, clickedCorner.id);
      render();
      return;
    }
  }

  if (state.tool === 'wall') {
    if (clickedWall) {
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

// ДВОЙНОЙ КЛИК: Редактирование точки/метки или центрирование холста
canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const floor = getCurrentFloor();
  if (!floor) return;

  const clickedCorner = findCornerAt(world.x, world.y);
  const clickedPoi = findPoiAt(world.x, world.y);

  if (clickedCorner) {
    openCornerEditModal(clickedCorner);
  } else if (clickedPoi) {
    openPoiModal(clickedPoi.x, clickedPoi.y, clickedPoi);
  } else {
    // Двойной клик по пустому месту — центрировать холст на этой точке!
    centerOnPoint(world.x, world.y);
    render();
    updateStatusHint(`Вид центрирован на координатах (${Math.round(world.x)}, ${Math.round(world.y)})`);
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

let currentCreateMode = 'absolute';

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

tabModeAbsolute?.addEventListener('click', () => setCreateMode('absolute'));
tabModeRelative?.addEventListener('click', () => setCreateMode('relative'));

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
  if (!previewFinalCoords) return;
  const coords = getFinalCalculatedCoords();
  previewFinalCoords.innerText = `X: ${coords.x}, Y: ${coords.y}`;
}

[inputCreateX, inputCreateY, inputRelDx, inputRelDy].forEach(inp => {
  inp?.addEventListener('input', updateCreatePreview);
});

selectRelativeBase?.addEventListener('change', updateCreatePreview);

function openCornerCreateModal(defaultX = 0, defaultY = 0) {
  const floor = getCurrentFloor();
  inputCreateX.value = defaultX;
  inputCreateY.value = defaultY;

  selectRelativeBase.innerHTML = '';
  if (floor && floor.corners.length > 0) {
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
  modalCornerCreate?.classList.add('hidden');
}

document.getElementById('btn-close-create-modal')?.addEventListener('click', closeCornerCreateModal);
document.getElementById('btn-cancel-create-modal')?.addEventListener('click', closeCornerCreateModal);
document.getElementById('btn-open-create-modal-btn')?.addEventListener('click', () => openCornerCreateModal(0, 0));

formCreateCorner?.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor) return;

  const finalCoords = getFinalCalculatedCoords();
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

// Закрытие модальных окон по Esc и горячие клавиши
window.addEventListener('keydown', e => {
  const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

  if (e.key === 'Escape') {
    if (isInputActive) {
      document.activeElement.blur();
    }
    closeCornerCreateModal();
    closeCornerEditModal();
    modalJson?.classList.add('hidden');
    modalPoiEdit?.classList.add('hidden');

    if (state.wallStartCornerId) {
      state.wallStartCornerId = null;
      updateStatusHint('Рисование стены завершено (привязка сброшена).');
      render();
      return;
    }

    state.selectedCornerId = null;
    state.selectedPoiId = null;
    setTool('corner');
    render();
    return;
  }

  // Если фокус в любом поле ввода, не перехватываем Delete / Backspace!
  if (isInputActive) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const floor = getCurrentFloor();
    if (!floor) return;
    if (state.selectedPoiId) {
      const p = floor.pois.find(item => item.id === state.selectedPoiId);
      floor.pois = floor.pois.filter(item => item.id !== state.selectedPoiId);
      state.selectedPoiId = null;
      updateStatusHint(p ? `Метка «${p.name}» удалена.` : 'Метка удалена.');
      updateFloorUI();
      render();
    } else if (state.selectedCornerId) {
      deleteCorner(floor, state.selectedCornerId);
      render();
    } else if (state.hoverWallId) {
      deleteWall(floor, state.hoverWallId);
      render();
    }
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
  modalCornerEdit?.classList.add('hidden');
  state.editingCornerId = null;
}

document.getElementById('btn-close-corner-modal')?.addEventListener('click', closeCornerEditModal);
document.getElementById('btn-cancel-corner-modal')?.addEventListener('click', closeCornerEditModal);

formEditCorner?.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor || !state.editingCornerId) return;

  const corner = floor.corners.find(c => c.id === state.editingCornerId);
  if (corner) {
    const newX = parseInt(inputCornerX.value) || 0;
    const newY = parseInt(inputCornerY.value) || 0;

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

// МОДАЛКА МЕТОК (POI / СТЕНДОВ)
const modalPoiEdit = document.getElementById('modal-poi-edit');
const formEditPoi = document.getElementById('form-edit-poi');
const inputPoiName = document.getElementById('input-poi-name');
let currentPoiCoords = null;
let editingPoi = null;

function openPoiModal(x, y, existingPoi = null) {
  currentPoiCoords = { x, y };
  editingPoi = existingPoi;
  const floor = getCurrentFloor();
  const count = floor && floor.pois ? floor.pois.length + 1 : 1;
  const selectCat = document.getElementById('select-poi-category');

  if (existingPoi) {
    inputPoiName.value = existingPoi.name || '';
    if (selectCat && existingPoi.category) selectCat.value = existingPoi.category;
  } else {
    inputPoiName.value = `Стенд №${count}`;
    if (selectCat) selectCat.value = 'stand';
  }

  modalPoiEdit.classList.remove('hidden');
  inputPoiName.focus();
  inputPoiName.select();
}

document.getElementById('btn-close-poi-modal')?.addEventListener('click', () => {
  modalPoiEdit.classList.add('hidden');
  editingPoi = null;
});
document.getElementById('btn-cancel-poi-modal')?.addEventListener('click', () => {
  modalPoiEdit.classList.add('hidden');
  editingPoi = null;
});

formEditPoi?.addEventListener('submit', e => {
  e.preventDefault();
  const floor = getCurrentFloor();
  if (!floor || !currentPoiCoords) return;

  const selectCat = document.getElementById('select-poi-category');
  const category = selectCat ? selectCat.value : 'stand';
  const nameVal = inputPoiName.value.trim() || 'Стенд';

  if (editingPoi) {
    editingPoi.name = nameVal;
    editingPoi.category = category;
    updateStatusHint(`Метка «${nameVal}» обновлена.`);
  } else {
    floor.pois.push({
      id: genId('poi'),
      name: nameVal,
      category: category,
      x: currentPoiCoords.x,
      y: currentPoiCoords.y
    });
    updateStatusHint(`Метка «${nameVal}» добавлена на карту.`);
  }

  editingPoi = null;
  modalPoiEdit.classList.add('hidden');
  updateFloorUI();
  render();
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
  let snappedX = snap(world.x);
  let snappedY = snap(world.y);

  // Ортогональная привязка к 90° при зажатом Shift в режиме стены
  if (e.shiftKey && state.tool === 'wall' && state.wallStartCornerId) {
    const floor = getCurrentFloor();
    const startC = floor ? floor.corners.find(c => c.id === state.wallStartCornerId) : null;
    if (startC) {
      if (Math.abs(snappedX - startC.x) > Math.abs(snappedY - startC.y)) {
        snappedY = startC.y;
      } else {
        snappedX = startC.x;
      }
    }
  }

  state.mouseWorld = { x: snappedX, y: snappedY };

  const floor = getCurrentFloor();
  if (floor) {
    if (state.isDraggingCorner && state.selectedCornerId) {
      const mouseDist = Math.hypot(sx - state.dragStartMouse.x, sy - state.dragStartMouse.y);
      if (mouseDist > 3) {
        state.hasDragged = true;
      }

      const corner = floor.corners.find(c => c.id === state.selectedCornerId);
      if (corner) {
        corner.x = snappedX;
        corner.y = snappedY;
        recalculateWallLengths(floor);
      }
    }

    state.hoverCornerId = findCornerAt(world.x, world.y)?.id || null;
    state.hoverWallId = findWallAt(world.x, world.y)?.id || null;
    state.hoverPoiId = findPoiAt(world.x, world.y)?.id || null;
  }

  render();
});

window.addEventListener('mouseup', () => {
  const floor = getCurrentFloor();

  if (state.isDraggingCorner && floor) {
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
  state.pan.y = sy + worldBefore.y * state.zoom;

  document.getElementById('zoom-indicator').innerText = `${Math.round(state.zoom * 100)}%`;
  render();
}, { passive: false });

// Инструменты
const toolButtons = {
  corner: document.getElementById('tool-corner'),
  wall: document.getElementById('tool-wall'),
  poi: document.getElementById('tool-poi'),
  delete: document.getElementById('tool-delete')
};

function setTool(toolName) {
  state.tool = toolName;
  state.wallStartCornerId = null;

  Object.keys(toolButtons).forEach(name => {
    const btn = toolButtons[name];
    if (!btn) return;
    if (name === toolName) {
      btn.classList.add('active-tool');
      btn.classList.remove('hover:bg-slate-800', 'text-slate-300');
    } else {
      btn.classList.remove('active-tool');
      btn.classList.add('hover:bg-slate-800', 'text-slate-300');
    }
  });

  const hints = {
    corner: 'Клик в пустоту — создать точку. Зажмите точку — перетащите её. Двойной клик — изменить.',
    wall: 'Кликните начальную точку, затем следующую. Удерживайте Shift для ровных углов 90°. Esc — завершить.',
    poi: 'Кликните по плану, чтобы поставить метку стенда или зала.',
    delete: 'Кликните по точке, стене или метке для удаления.'
  };
  updateStatusHint(hints[toolName] || '');
  render();
}

Object.keys(toolButtons).forEach(toolName => {
  toolButtons[toolName]?.addEventListener('click', () => setTool(toolName));
});

function updateStatusHint(text) {
  const el = document.getElementById('status-hint');
  if (el) {
    el.innerHTML = `
      <i class="fa-solid fa-circle-info text-blue-400"></i>
      <span>${text}</span>
    `;
  }
}

document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
  state.zoom = Math.min(4.0, state.zoom * 1.2);
  document.getElementById('zoom-indicator').innerText = `${Math.round(state.zoom * 100)}%`;
  render();
});
document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
  state.zoom = Math.max(0.2, state.zoom / 1.2);
  document.getElementById('zoom-indicator').innerText = `${Math.round(state.zoom * 100)}%`;
  render();
});
document.getElementById('btn-reset-view')?.addEventListener('click', () => {
  state.pan = { x: 100, y: 550 };
  state.zoom = 1.0;
  document.getElementById('zoom-indicator').innerText = '100%';
  render();
});

// Мобильное открытие/закрытие панели этажей и параметров
const editorSidebar = document.getElementById('editor-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');

function openMobileSidebar() {
  editorSidebar?.classList.remove('-translate-x-full');
  sidebarBackdrop?.classList.remove('hidden');
}

function closeMobileSidebar() {
  editorSidebar?.classList.add('-translate-x-full');
  sidebarBackdrop?.classList.add('hidden');
}

btnToggleSidebar?.addEventListener('click', openMobileSidebar);
btnCloseSidebar?.addEventListener('click', closeMobileSidebar);
sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

// Поддержка сенсорных экранов (смартфоны и планшеты)
let lastTouchDist = 0;
let touchStartPoint = { x: 0, y: 0 };
let touchMoved = false;

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartPoint = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    touchMoved = false;

    const mouseEvent = new MouseEvent('mousedown', {
      clientX: t.clientX,
      clientY: t.clientY,
      button: 0,
      bubbles: true
    });
    canvas.dispatchEvent(mouseEvent);
  } else if (e.touches.length === 2) {
    e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const rect = canvas.getBoundingClientRect();
    const midX = ((t1.clientX + t2.clientX) / 2) - rect.left;
    const midY = ((t1.clientY + t2.clientY) / 2) - rect.top;
    state.isPanning = true;
    state.panStart = { x: midX - state.pan.x, y: midY - state.pan.y };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const curX = t.clientX - rect.left;
    const curY = t.clientY - rect.top;
    if (Math.hypot(curX - touchStartPoint.x, curY - touchStartPoint.y) > 5) {
      touchMoved = true;
    }
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: t.clientX,
      clientY: t.clientY,
      button: 0,
      bubbles: true
    });
    window.dispatchEvent(mouseEvent);
  } else if (e.touches.length === 2) {
    e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const rect = canvas.getBoundingClientRect();
    const midX = ((t1.clientX + t2.clientX) / 2) - rect.left;
    const midY = ((t1.clientY + t2.clientY) / 2) - rect.top;

    const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    if (lastTouchDist > 0) {
      const zoomFactor = newDist / lastTouchDist;
      const worldBefore = screenToWorld(midX, midY);
      state.zoom = Math.min(Math.max(0.2, state.zoom * zoomFactor), 4.0);
      state.pan.x = midX - worldBefore.x * state.zoom;
      state.pan.y = midY + worldBefore.y * state.zoom;
      const zoomInd = document.getElementById('zoom-indicator');
      if (zoomInd) zoomInd.innerText = `${Math.round(state.zoom * 100)}%`;
      render();
    }
    lastTouchDist = newDist;

    state.pan.x = midX - state.panStart.x;
    state.pan.y = midY - state.panStart.y;
    render();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    state.isPanning = false;
    lastTouchDist = 0;
    const mouseEvent = new MouseEvent('mouseup', { bubbles: true });
    window.dispatchEvent(mouseEvent);
  }
});

// -------------------------------------------------------------
// ВЫБОР ЭТАЖА И СПИСКИ ВЕРШИН / СТЕН / МЕТОК
// -------------------------------------------------------------
const floorsListEl = document.getElementById('floors-list');
const cornersListEl = document.getElementById('corners-list');
const wallsListEl = document.getElementById('walls-list');
const poisListEl = document.getElementById('pois-list');

const inputFloorName = document.getElementById('input-floor-name');
const inputFloorLevel = document.getElementById('input-floor-level');
const inputFloorHeight = document.getElementById('input-floor-height');

// Вкладки сайдбара
const tabButtons = {
  floors: document.getElementById('tab-btn-floors'),
  corners: document.getElementById('tab-btn-corners'),
  walls: document.getElementById('tab-btn-walls'),
  pois: document.getElementById('tab-btn-pois')
};

const tabContents = {
  floors: document.getElementById('tab-content-floors'),
  corners: document.getElementById('tab-content-corners'),
  walls: document.getElementById('tab-content-walls'),
  pois: document.getElementById('tab-content-pois')
};

function switchSidebarTab(tabName) {
  Object.keys(tabButtons).forEach(name => {
    const btn = tabButtons[name];
    const content = tabContents[name];
    if (!btn || !content) return;
    if (name === tabName) {
      btn.className = 'sidebar-tab flex-1 py-1.5 px-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 bg-slate-800 text-white shadow-sm border border-slate-700';
      content.classList.remove('hidden');
    } else {
      btn.className = 'sidebar-tab flex-1 py-1.5 px-1.5 rounded-lg font-medium flex items-center justify-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800/50 transition';
      content.classList.add('hidden');
    }
  });
}

Object.keys(tabButtons).forEach(name => {
  tabButtons[name]?.addEventListener('click', () => switchSidebarTab(name));
});

function renderFloorsList() {
  if (!floorsListEl) return;
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
  if (!cornersListEl) return;
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

// Список стен текущего этажа
function renderWallsList(floor) {
  if (!wallsListEl) return;
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

// Список меток текущего этажа
function renderPoisList(floor) {
  if (!poisListEl) return;
  poisListEl.innerHTML = '';
  if (!floor || !floor.pois || floor.pois.length === 0) {
    poisListEl.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-500">
        <i class="fa-solid fa-location-dot text-2xl mb-2 text-slate-600 block"></i>
        Нет добавленных меток.<br>Выберите инструмент "Метка" и кликните по холсту.
      </div>
    `;
    return;
  }

  floor.pois.forEach(poi => {
    const isSelected = state.selectedPoiId === poi.id;
    const cat = POI_CATEGORIES[poi.category] || POI_CATEGORIES.stand;
    const card = document.createElement('div');
    card.className = `p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
      isSelected 
        ? 'bg-red-500/15 border-red-500 text-white' 
        : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
    }`;

    card.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-sm">${cat.icon}</span>
        <div>
          <div class="font-semibold text-slate-200 text-xs">${poi.name}</div>
          <div class="text-[10px] text-slate-400 font-mono">${cat.label} · (${poi.x}, ${poi.y})</div>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn-edit-poi text-slate-400 hover:text-amber-400 p-1 rounded transition" title="Изменить">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-del-poi text-slate-400 hover:text-rose-400 p-1 rounded transition" title="Удалить">
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

    card.querySelector('.btn-edit-poi')?.addEventListener('click', e => {
      e.stopPropagation();
      openPoiModal(poi.x, poi.y, poi);
    });

    card.querySelector('.btn-del-poi').addEventListener('click', e => {
      e.stopPropagation();
      floor.pois = floor.pois.filter(p => p.id !== poi.id);
      updateFloorUI();
      render();
    });

    poisListEl.appendChild(card);
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
  renderPoisList(floor);

  if (floor && inputFloorName) {
    inputFloorName.value = floor.name;
    inputFloorLevel.value = floor.level;
    inputFloorHeight.value = floor.height;
    const badge = document.getElementById('active-floor-badge');
    if (badge) badge.innerText = floor.name;
  }
  updateStats();

  if (typeof autoSave === 'function') {
    autoSave();
  }
}

function updateStats() {
  const floor = getCurrentFloor();
  const cCount = floor ? floor.corners.length : 0;
  const wCount = floor ? floor.walls.length : 0;
  const pCount = floor && floor.pois ? floor.pois.length : 0;

  const statCorners = document.getElementById('stat-corners');
  const statWalls = document.getElementById('stat-walls');
  const tabCornersCount = document.getElementById('tab-corners-count');
  const tabWallsCount = document.getElementById('tab-walls-count');
  const tabPoisCount = document.getElementById('tab-pois-count');

  if (statCorners) statCorners.innerText = cCount;
  if (statWalls) statWalls.innerText = wCount;
  if (tabCornersCount) tabCornersCount.innerText = cCount;
  if (tabWallsCount) tabWallsCount.innerText = wCount;
  if (tabPoisCount) tabPoisCount.innerText = pCount;
}

inputFloorName?.addEventListener('input', e => {
  const floor = getCurrentFloor();
  if (floor) {
    floor.name = e.target.value;
    renderFloorsList();
  }
});

inputFloorLevel?.addEventListener('change', e => {
  const floor = getCurrentFloor();
  if (floor) {
    floor.level = parseInt(e.target.value) || 0;
    renderFloorsList();
  }
});

inputFloorHeight?.addEventListener('change', e => {
  const floor = getCurrentFloor();
  if (floor) {
    floor.height = parseFloat(e.target.value) || 3.0;
  }
});

document.getElementById('btn-add-floor')?.addEventListener('click', () => {
  const maxLevel = state.floors.reduce((max, f) => Math.max(max, f.level), 0);
  const nextLevel = maxLevel + 1;
  const newFloor = {
    id: `floor-${Date.now()}`,
    name: `${nextLevel} этаж`,
    level: nextLevel,
    height: 3.5,
    corners: [],
    walls: [],
    pois: []
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

document.getElementById('btn-export-json')?.addEventListener('click', () => {
  const jsonStr = exportToJSON();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ttk-venue-plan-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('json-file-input')?.addEventListener('change', e => {
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
    pois: Array.isArray(f.pois) ? f.pois : []
  }));

  state.activeFloorId = state.floors[0].id;
  updateFloorUI();
  render();
}

const modalJson = document.getElementById('modal-json');
const textareaJson = document.getElementById('json-editor-textarea');

document.getElementById('btn-view-json')?.addEventListener('click', () => {
  textareaJson.value = exportToJSON();
  modalJson.classList.remove('hidden');
});

document.getElementById('btn-close-modal')?.addEventListener('click', () => {
  modalJson.classList.add('hidden');
});

document.getElementById('btn-copy-json')?.addEventListener('click', () => {
  navigator.clipboard.writeText(textareaJson.value).then(() => {
    alert('JSON скопирован в буфер обмена!');
  });
});

document.getElementById('btn-apply-json')?.addEventListener('click', () => {
  try {
    const data = JSON.parse(textareaJson.value);
    loadJSONData(data);
    modalJson.classList.add('hidden');
  } catch (err) {
    alert('Ошибка в синтаксисе JSON: ' + err.message);
  }
});

// Загрузка подложки схемы (PNG/JPG)
const bgPlanInput = document.getElementById('bg-plan-input');
if (bgPlanInput) {
  bgPlanInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        state.bgImage = img;
        render();
        updateStatusHint('Подложка плана загружена. Обводите стены по чертежу!');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}

// Автосохранение для каждого открытого здания по ID
const urlParams = new URLSearchParams(window.location.search);
const currentSpaceId = urlParams.get('spaceId');

function autoSave() {
  if (currentSpaceId) {
    try {
      localStorage.setItem('spacemap_plan_' + currentSpaceId, exportToJSON());
    } catch (e) {
      console.warn('AutoSave error', e);
    }
  }
}

if (currentSpaceId) {
  const saved = localStorage.getItem('spacemap_plan_' + currentSpaceId);
  if (saved) {
    try {
      loadJSONData(JSON.parse(saved));
    } catch (e) {
      console.warn('Could not restore plan for', currentSpaceId);
    }
  }
}

// Старт
resizeCanvas();
updateFloorUI();
setTool('corner');
render();
