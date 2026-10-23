# Indoor Map & Panorama Service Backend

Backend-сервис для интерактивных карт помещений с поддержкой 360° фотопанорам, поэтажных планов и навигационных графов.

---

## Быстрый старт

### 1. Установка зависимостей
```bash
pip install -r backend/requirements.txt
```

### 2. Запуск сервера
```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

После старта сервер доступен по адресу `http://localhost:8000`.

- **Swagger UI (интерактивная документация)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Публичный JSON демо-пространства**: [http://localhost:8000/api/spaces/grand-atrium/public](http://localhost:8000/api/spaces/grand-atrium/public)

---

## Роутинг API

Все эндпоинты поддерживают контракт с именованием в **camelCase** (сохраняя обратную совместимость со **snake_case**).

### 1. Публичный доступ (Viewer)
| Метод | URL | Описание |
| :--- | :--- | :--- |
| `GET` | `/api/spaces/{slug}/public` | Полная структура пространства (этажи, POI, панорамы со связями, навигационный граф) для клиентского вьюера без авторизации. |

---

### 2. Пространства (Spaces)
| Метод | URL | Описание | Тело запроса / Параметры |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/spaces` | Список всех пространств | — |
| `POST` | `/api/spaces` | Создание нового пространства | JSON: `title`, `slug`, `description?`, `isPublished?` |

---

### 3. Этажи (Floors)
| Метод | URL | Описание | Тело запроса / Параметры |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/floors` | Создание этажа | JSON: `spaceId`, `level`, `name`, `width?`, `height?`, `navGraph?` |
| `POST` | `/api/floors/{floor_id}/upload-plan` | Загрузка файла плана этажа (PNG, JPG, SVG, WebP) в `static/uploads/plans`. Автоопределение ширины и высоты (Pillow). | `multipart/form-data`: `file`, опционально `width`, `height` |
| `PUT` | `/api/floors/{floor_id}/graph` | Обновление навигационного графа этажа | JSON: `{ "navGraph": { "nodes": [...], "edges": [...] } }` |

---

### 4. Панорамы 360° (Panoramas)
| Метод | URL | Описание | Тело запроса / Параметры |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/panoramas/upload` | Загрузка эквидистантной 360° фотопанорамы, генерация Pillow-миниатюры (в `thumbs/`) и создание записи в БД | `multipart/form-data`: `file`, `floorId?`, `title?`, `x?`, `y?`, `connections?` |
| `GET` | `/api/panoramas` | Список панорам | Query: `floorId?` |
| `POST` | `/api/panoramas` | Создание записи панорамы вручную | JSON: `floorId`, `title`, `imageUrl`, `thumbnailUrl?`, `x`, `y`, `connections` |
| `GET` | `/api/panoramas/{id}` | Получение панорамы по ID | — |
| `PUT` | `/api/panoramas/{id}` | Обновление данных панорамы | JSON: `title?`, `imageUrl?`, `thumbnailUrl?`, `x?`, `y?`, `connections?`, `floorId?` |
| `DELETE` | `/api/panoramas/{id}` | Удаление панорамы | — |

---

### 5. Точки интереса (POI)
| Метод | URL | Описание | Тело запроса / Параметры |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/pois` | Список точек интереса | Query: `floorId?`, `category?` |
| `POST` | `/api/pois` | Создание новой POI | JSON: `floorId`, `title`, `category`, `description?`, `x`, `y`, `panoramaId?` |
| `GET` | `/api/pois/{id}` | Получение POI по ID | — |
| `PUT` | `/api/pois/{id}` | Обновление POI | JSON: `title?`, `category?`, `description?`, `x?`, `y?`, `panoramaId?`, `floorId?` |
| `DELETE` | `/api/pois/{id}` | Удаление POI | — |

> **Категории POI**: `'hall' | 'booth' | 'service' | 'wifi' | 'entrance' | 'wc' | 'food'`  
> **Координаты `x`, `y`**: `0..100%` относительно размеров плана этажа.

---

### 6. Статические файлы
Статика монтируется по пути `/static`:
- Планы этажей: `/static/uploads/plans/{filename}`
- Основные панорамы 360°: `/static/uploads/panoramas/{filename}`
- Миниатюры панорам: `/static/uploads/panoramas/thumbs/{filename}`

---

## Структура проекта

```text
xrencard/
├── backend/
│   ├── main.py              # Эндпоинты, lifespan, CORS, статика, генерация Pillow-миниатюр
│   ├── models.py            # SQLAlchemy модели (Space, Floor, POI, Panorama)
│   ├── schemas.py           # Pydantic v2 схемы (camelCase, строковые ID)
│   ├── database.py          # Инициализация SQLite (indoor_maps.db)
│   ├── requirements.txt     # Зависимости
│   ├── indoor_maps.db       # База данных с mock-данными
│   └── static/
│       └── uploads/
│           ├── plans/       # SVG / PNG планы
│           └── panoramas/   # 360° фото и thumbs/
├── .gitignore
└── README.md
```
