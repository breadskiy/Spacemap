import base64
import os
import re
import shutil
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

try:
    from database import Base, engine, get_db
    import models
    import schemas
    from auth import (
        hash_password,
        verify_password,
        create_access_token,
        get_current_user,
        get_current_user_optional,
    )
    from qr import build_viewer_url, render_qr_svg, validate_http_url
    from stitch_panorama import stitch_to_8k
except ImportError:
    from backend.database import Base, engine, get_db
    from backend import models
    from backend import schemas
    from backend.auth import (
        hash_password,
        verify_password,
        create_access_token,
        get_current_user,
        get_current_user_optional,
    )
    from backend.qr import build_viewer_url, render_qr_svg, validate_http_url
    try:
        from backend.stitch_panorama import stitch_to_8k
    except ImportError:
        stitch_to_8k = None

# ==========================================
# Paths & Directories
# ==========================================
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
PLANS_DIR = UPLOADS_DIR / "plans"
PANORAMAS_DIR = UPLOADS_DIR / "panoramas"
THUMBS_DIR = PANORAMAS_DIR / "thumbs"

for d in [PLANS_DIR, PANORAMAS_DIR, THUMBS_DIR]:
    os.makedirs(d, exist_ok=True)


# ==========================================
# Helpers: Pillow Thumbnail & Mock Gen
# ==========================================
def create_image_thumbnail(source_path: str, dest_path: str, size: tuple = (400, 200)) -> None:
    """Генерирует миниатюру изображения через Pillow с безопасной конвертацией RGBA."""
    with Image.open(source_path) as img:
        img_copy = img.copy()
        if img_copy.mode in ("RGBA", "LA", "P"):
            rgb_img = Image.new("RGB", img_copy.size, (255, 255, 255))
            if img_copy.mode == "P":
                img_copy = img_copy.convert("RGBA")
            mask = img_copy.split()[-1] if img_copy.mode == "RGBA" else None
            rgb_img.paste(img_copy, mask=mask)
            img_copy = rgb_img
        elif img_copy.mode != "RGB":
            img_copy = img_copy.convert("RGB")

        img_copy.thumbnail(size, Image.Resampling.LANCZOS)
        img_copy.save(dest_path, "JPEG", quality=85)


def generate_mock_files_if_missing():
    """Создаёт демонстрационные заглушки для панорам, чтобы ссылки не отдавали 404."""
    panos_meta = [
        ("pano_reception.jpg", "thumb_pano_reception.jpg", (30, 144, 255), "360° Reception & Lobby"),
        ("pano_atrium.jpg", "thumb_pano_atrium.jpg", (218, 165, 32), "360° Central Atrium"),
        ("pano_hall.jpg", "thumb_pano_hall.jpg", (220, 20, 60), "360° Grand Congress Hall"),
    ]
    for pano_file, thumb_file, color, title in panos_meta:
        pano_path = os.path.join(PANORAMAS_DIR, pano_file)
        thumb_path = os.path.join(THUMBS_DIR, thumb_file)
        if not os.path.exists(pano_path):
            img = Image.new("RGB", (1024, 512), color=color)
            draw = ImageDraw.Draw(img)
            draw.rectangle([20, 20, 1004, 492], outline=(255, 255, 255), width=4)
            draw.text((512, 256), title, fill=(255, 255, 255), anchor="mm")
            img.save(pano_path, "JPEG", quality=85)
        if not os.path.exists(thumb_path):
            create_image_thumbnail(pano_path, thumb_path, size=(400, 200))


def slugify(text: str) -> str:
    """Генерирует аккуратный slug из названия."""
    slug = text.lower().strip()
    slug = re.sub(r'[^a-zа-я0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug or "space"


def serialize_space(space: models.Space, request: Optional[Request] = None) -> schemas.SpaceResponse:
    """Форматирует объект пространства под контракт фронтенда."""
    base_url = str(request.base_url) if request else "http://localhost:5173"
    public_url = build_viewer_url(base_url, space.id, space.slug) if space.status == "published" else None
    
    formatted_date = space.updated_at.strftime("%d.%m.%Y, %H:%M") if space.updated_at else ""
    owner_str = str(space.owner_id) if space.owner_id else None

    return schemas.SpaceResponse(
        id=str(space.id),
        user_id=owner_str,
        userId=owner_str,
        title=space.title,
        category=space.category,  # type: ignore
        category_label=schemas.CATEGORY_LABELS.get(space.category, "Пространство"),
        address=space.address,
        description=space.description or "",
        status=space.status,
        floors_count=space.floors_count,
        walls_count=space.walls_count,
        updated_at=formatted_date,
        public_url=public_url,
    )


# ==========================================
# Database Seeder (При первом запуске)
# ==========================================
def seed_mock_data():
    generate_mock_files_if_missing()
    db: Session = next(get_db())
    try:
        # Проверяем, есть ли уже данные
        if db.query(models.Space).count() > 0:
            return

        # 1. Тестовый организатор ТТК
        admin = models.User(
            email="organizer@ttk.ru",
            password_hash=hash_password("admin123"),
            display_name="Организатор ТТК",
            company="АО «ТрансТелеКом»",
            role="organizer",
            is_active=True,
        )
        db.add(admin)
        db.flush()

        # 2. Демонстрационное пространство
        space = models.Space(
            owner_id=admin.id,
            title="Форум «Транспорт Будущего 2026»",
            slug="transport-future-2026",
            category="conference",
            address="г. Москва, Краснопресненская наб., 14",
            description="Цифровой 2D-план этажей, стен и интерактивной навигации для участников форума.",
            status="published",
            floors_count=1,
            walls_count=4,
        )
        db.add(space)
        db.flush()

        # 3. Базовый контур зала со стенами и панорамой (PlanData)
        demo_plan = {
            "floors": [
                {
                    "id": "floor-1",
                    "name": "1 этаж",
                    "level": 1,
                    "height": 3.5,
                    "corners": [
                        {"id": "1", "x": 100.0, "y": 100.0},
                        {"id": "2", "x": 500.0, "y": 100.0},
                        {"id": "3", "x": 500.0, "y": 400.0},
                        {"id": "4", "x": 100.0, "y": 400.0},
                    ],
                    "walls": [
                        {"id": "w_1", "from": "1", "to": "2", "length": 400},
                        {"id": "w_2", "from": "2", "to": "3", "length": 300},
                        {"id": "w_3", "from": "3", "to": "4", "length": 400},
                        {"id": "w_4", "from": "4", "to": "1", "length": 300},
                    ],
                    "rooms": [
                        {
                            "id": "room_1",
                            "name": "Главный экспо-зал",
                            "color": "#3b82f6",
                            "corners": ["1", "2", "3", "4"],
                        }
                    ],
                    "pois": [
                        {
                            "id": "poi_1",
                            "name": "Инфостойка Регистрации",
                            "category": "info",
                            "x": 200.0,
                            "y": 180.0,
                            "description": "Выдача бейджей и навигационных карт",
                            "roomId": "room_1",
                        }
                    ],
                    "panoramas": [
                        {
                            "id": "pano_1",
                            "name": "360° Обзор Атриума",
                            "x": 300.0,
                            "y": 250.0,
                            "roomId": "room_1",
                            "image": "/static/uploads/panoramas/pano_atrium.jpg",
                            "viewAngle": 0.0,
                        }
                    ],
                }
            ]
        }

        plan_ver = models.PlanVersion(
            space_id=space.id,
            version=1,
            status="published",
            data=demo_plan,
            created_by=admin.id,
            published_at=datetime.utcnow(),
        )
        db.add(plan_ver)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Notice: Seed data skipping: {e}")
    finally:
        db.close()


# ==========================================
# FastAPI Lifespan
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ожидаем готовности базы данных PostgreSQL при старте контейнера (до 15 попыток)
    import time
    for attempt in range(1, 16):
        try:
            Base.metadata.create_all(bind=engine)
            print(f"[SpaceMap] База данных PostgreSQL готова (попытка {attempt})")
            break
        except Exception as e:
            if attempt == 15:
                print(f"[SpaceMap] Критическая ошибка подключения к БД: {e}")
                raise
            print(f"[SpaceMap] Ожидание готовности PostgreSQL (попытка {attempt}/15, {e})...")
            time.sleep(2)
    yield


# ==========================================
# Application Init
# ==========================================
app = FastAPI(
    title="SpaceMap 2D CAD & Indoor Navigation API",
    description=(
        "REST API сервиса SpaceMap для цифровых 2D CAD-планов этажей, "
        "векторных стен, комнат, 360-панорам и QR-навигации посетителей."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware: открываем доступ фронтенду (любой порт Vite / dev-сервера)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статика для загруженных планов и панорам
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "SpaceMap API",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "online",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# =============================================================================
# 1. 🔐 AUTH ENDPOINTS
# =============================================================================

@app.post(
    "/api/auth/register",
    response_model=schemas.TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация нового организатора",
    tags=["Auth"],
)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")

    user = models.User(
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        display_name=payload.name.strip(),
        company=payload.company or "",
        role=payload.role or "organizer",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.role)
    disp_name = user.display_name.strip() or user.email.split("@")[0]
    user_resp = schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=disp_name,
        display_name=disp_name,
        company=user.company or "",
        role=user.role or "organizer",
    )
    return schemas.TokenResponse(access_token=token, token_type="bearer", user=user_resp)


@app.post(
    "/api/auth/login",
    response_model=schemas.TokenResponse,
    summary="Вход в личный кабинет",
    tags=["Auth"],
)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")

    token = create_access_token(user.id, user.email, user.role)
    disp_name = user.display_name.strip() or user.email.split("@")[0]
    user_resp = schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=disp_name,
        display_name=disp_name,
        company=user.company or "",
        role=user.role or "organizer",
    )
    return schemas.TokenResponse(access_token=token, token_type="bearer", user=user_resp)


@app.get(
    "/api/auth/me",
    response_model=schemas.UserResponse,
    summary="Данные текущего авторизованного пользователя",
    tags=["Auth"],
)
def get_me(user: models.User = Depends(get_current_user)):
    disp_name = user.display_name.strip() or user.email.split("@")[0]
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=disp_name,
        display_name=disp_name,
        company=user.company or "",
        role=user.role or "organizer",
    )


@app.put(
    "/api/auth/profile",
    response_model=schemas.UserResponse,
    summary="Обновление настроек профиля",
    tags=["Auth"],
)
def update_profile(
    payload: schemas.UserUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.name:
        user.display_name = payload.name.strip()
    if payload.company is not None:
        user.company = payload.company.strip()
    if payload.password:
        user.password_hash = hash_password(payload.password)
    
    db.commit()
    db.refresh(user)
    disp_name = user.display_name.strip() or user.email.split("@")[0]
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=disp_name,
        display_name=disp_name,
        company=user.company or "",
        role=user.role or "organizer",
    )


# =============================================================================
# 2. 🏢 SPACES / ПРОСТРАНСТВА
# =============================================================================

@app.get(
    "/api/spaces",
    response_model=List[schemas.SpaceResponse],
    summary="Список пространств и мероприятий",
    tags=["Spaces"],
)
def list_spaces(
    request: Request,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Возвращает список пространств: опубликованные + собственные объекты вошедшего организатора."""
    query = db.query(models.Space)
    if current_user:
        spaces = query.filter(
            (models.Space.status == "published") | (models.Space.owner_id == current_user.id)
        ).order_by(models.Space.created_at.desc()).all()
    else:
        spaces = query.filter(models.Space.status == "published").order_by(models.Space.created_at.desc()).all()

    return [serialize_space(s, request) for s in spaces]


@app.post(
    "/api/spaces",
    response_model=schemas.SpaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создание нового объекта / площадки",
    tags=["Spaces"],
)
def create_space(
    payload: schemas.SpaceCreate,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_slug = slugify(payload.title)
    unique_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    space = models.Space(
        owner_id=current_user.id,
        title=payload.title.strip(),
        slug=unique_slug,
        category=payload.category,
        address=payload.address.strip() or "Адрес не указан",
        description=payload.description or "",
        status="draft",
        floors_count=1,
        walls_count=0,
    )
    db.add(space)
    db.commit()
    db.refresh(space)

    # Создаём начальный пустой план этажа (DEFAULT_PLAN)
    initial_plan = {
        "floors": [
            {
                "id": "floor-1",
                "name": "1 этаж",
                "level": 1,
                "height": 3.5,
                "corners": [],
                "walls": [],
                "rooms": [],
                "pois": [],
                "panoramas": [],
            }
        ]
    }
    plan_ver = models.PlanVersion(
        space_id=space.id,
        version=1,
        status="draft",
        data=initial_plan,
        created_by=current_user.id if current_user else None,
    )
    db.add(plan_ver)
    db.commit()

    return serialize_space(space, request)


@app.get(
    "/api/spaces/{space_id}",
    response_model=schemas.SpaceResponse,
    summary="Получение сведений о пространстве по ID или slug",
    tags=["Spaces"],
)
def get_space(space_id: str, request: Request, db: Session = Depends(get_db)):
    space = db.query(models.Space).filter((models.Space.id == space_id) | (models.Space.slug == space_id)).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    return serialize_space(space, request)


@app.put(
    "/api/spaces/{space_id}",
    response_model=schemas.SpaceResponse,
    summary="Редактирование сведений о пространстве",
    tags=["Spaces"],
)
def update_space(
    space_id: str,
    payload: schemas.SpaceUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    space = db.query(models.Space).filter(models.Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")

    if payload.title:
        space.title = payload.title.strip()
    if payload.category:
        space.category = payload.category
    if payload.address is not None:
        space.address = payload.address.strip()
    if payload.description is not None:
        space.description = payload.description
    if payload.status:
        space.status = payload.status

    space.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(space)
    return serialize_space(space, request)


@app.delete(
    "/api/spaces/{space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление пространства",
    tags=["Spaces"],
)
def delete_space(space_id: str, db: Session = Depends(get_db)):
    space = db.query(models.Space).filter(models.Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    db.delete(space)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/api/spaces/{space_id}/publish",
    response_model=schemas.SpaceResponse,
    summary="Опубликовать пространство и сделать доступным для посетителей",
    tags=["Spaces"],
)
def publish_space(space_id: str, request: Request, db: Session = Depends(get_db)):
    space = db.query(models.Space).filter(models.Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")

    space.status = "published"
    space.updated_at = datetime.utcnow()

    # Помечаем последнюю версию плана как опубликованную
    latest_ver = db.query(models.PlanVersion).filter(models.PlanVersion.space_id == space.id).order_by(models.PlanVersion.version.desc()).first()
    if latest_ver:
        latest_ver.status = "published"
        latest_ver.published_at = datetime.utcnow()

    db.commit()
    db.refresh(space)
    return serialize_space(space, request)


# =============================================================================
# 3. 📐 PLAN EDITOR (2D CAD-чертежи: стены, точки, зоны)
# =============================================================================

@app.get(
    "/api/spaces/{space_id}/plan",
    response_model=schemas.PlanDataSchema,
    summary="Получение полного 2D CAD-плана этажей (стены, углы, зоны, POI, панорамы)",
    tags=["Plan Editor"],
)
def get_space_plan(space_id: str, db: Session = Depends(get_db)):
    """Возвращает актуальный PlanData JSON для редактора или режима просмотра."""
    space = db.query(models.Space).filter((models.Space.id == space_id) | (models.Space.slug == space_id)).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")

    plan_ver = (
        db.query(models.PlanVersion)
        .filter(models.PlanVersion.space_id == space.id)
        .order_by(models.PlanVersion.version.desc())
        .first()
    )

    if not plan_ver or not plan_ver.data:
        # Если чертежа нет, возвращаем пустой этаж
        return schemas.PlanDataSchema(
            floors=[
                schemas.PlanFloorSchema(
                    id="floor-1",
                    name="1 этаж",
                    level=1,
                    height=3.5,
                    corners=[],
                    walls=[],
                    rooms=[],
                    pois=[],
                    panoramas=[],
                )
            ]
        )

    return plan_ver.data


@app.put(
    "/api/spaces/{space_id}/plan",
    response_model=schemas.PlanDataSchema,
    summary="Сохранение 2D CAD-плана этажей из редактора",
    tags=["Plan Editor"],
)
def save_space_plan(
    space_id: str,
    payload: schemas.PlanDataSchema,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Принимает из редактора JSON со всеми этажами, стенами, комнатами, POI и панорамами и сохраняет в БД."""
    space = db.query(models.Space).filter((models.Space.id == space_id) | (models.Space.slug == space_id)).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")

    # Считаем количество стен и этажей для отображения на карточке
    total_walls = sum(len(f.walls) for f in payload.floors)
    total_floors = max(1, len(payload.floors))

    space.walls_count = total_walls
    space.floors_count = total_floors
    space.updated_at = datetime.utcnow()

    # Ищем актуальную версию плана пространства (всегда обновляем текущую рабочую версию)
    latest_ver = (
        db.query(models.PlanVersion)
        .filter(models.PlanVersion.space_id == space.id)
        .order_by(models.PlanVersion.version.desc())
        .first()
    )

    json_dict = payload.model_dump(by_alias=True)

    if latest_ver:
        latest_ver.data = json_dict
        latest_ver.updated_at = datetime.utcnow()
        if space.status == "published":
            latest_ver.status = "published"
            latest_ver.published_at = datetime.utcnow()
    else:
        latest_ver = models.PlanVersion(
            space_id=space.id,
            version=1,
            status=space.status or "draft",
            data=json_dict,
            created_by=current_user.id if current_user else space.owner_id,
            published_at=datetime.utcnow() if space.status == "published" else None,
        )
        db.add(latest_ver)

    # Синхронизируем POI и панорамы в реляционные таблицы
    try:
        db.query(models.POI).filter(models.POI.space_id == space.id).delete()
        db.query(models.Panorama).filter(models.Panorama.space_id == space.id).delete()

        for floor in payload.floors:
            for poi in floor.pois:
                db_poi = models.POI(
                    space_id=space.id,
                    floor_id=floor.id,
                    title=poi.name,
                    category=poi.category,
                    description=poi.description or "",
                    x=poi.x,
                    y=poi.y,
                    room_id=poi.room_id or poi.roomId,
                )
                db.add(db_poi)

            for pano in floor.panoramas:
                pano_img = pano.image or pano.image_data or pano.imageData or ""
                db_pano = models.Panorama(
                    space_id=space.id,
                    floor_id=floor.id,
                    title=pano.name,
                    image_url=pano_img,
                    x=pano.x,
                    y=pano.y,
                    view_angle=pano.view_angle or pano.viewAngle or 0.0,
                    room_id=pano.room_id or pano.roomId,
                )
                db.add(db_pano)
    except Exception as e:
        print(f"Notice: sync pois/panoramas table: {e}")

    db.commit()
    return latest_ver.data


# =============================================================================
# 4. 🌐 PUBLIC VIEWER & QR-КОД
# =============================================================================

@app.get(
    "/api/spaces/{slug}/public",
    response_model=schemas.SpacePublicResponse,
    summary="Публичное получение пространства и опубликованного плана",
    tags=["Public Viewer"],
)
def get_public_space(slug: str, request: Request, db: Session = Depends(get_db)):
    space = db.query(models.Space).filter(
        (models.Space.slug == slug) | (models.Space.id == slug),
        models.Space.status == "published",
    ).first()
    if not space:
        raise HTTPException(status_code=404, detail="Опубликованное пространство не найдено")

    latest_ver = (
        db.query(models.PlanVersion)
        .filter(models.PlanVersion.space_id == space.id, models.PlanVersion.status == "published")
        .order_by(models.PlanVersion.version.desc())
        .first()
    )
    if not latest_ver:
        latest_ver = (
            db.query(models.PlanVersion)
            .filter(models.PlanVersion.space_id == space.id)
            .order_by(models.PlanVersion.version.desc())
            .first()
        )

    space_resp = serialize_space(space, request)
    return schemas.SpacePublicResponse(
        **space_resp.model_dump(),
        plan=latest_ver.data if latest_ver else None,
    )


@app.get(
    "/api/spaces/{slug}/qr",
    summary="Генерация SVG QR-кода публичной ссылки на карту",
    response_class=Response,
    responses={
        200: {"content": {"image/svg+xml": {}}, "description": "SVG с QR-кодом"},
        404: {"description": "Пространство не найдено"},
    },
    tags=["Public Viewer"],
)
def get_space_qr(
    slug: str,
    request: Request,
    url: Optional[str] = Query(None, description="Опциональный кастомный URL для QR-кода"),
    db: Session = Depends(get_db),
):
    space = db.query(models.Space).filter((models.Space.slug == slug) | (models.Space.id == slug)).first()
    if not space:
        raise HTTPException(status_code=404, detail="Пространство не найдено")

    if url:
        try:
            target_url = validate_http_url(url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    else:
        target_url = build_viewer_url(str(request.base_url), space.id, space.slug)

    svg = render_qr_svg(target_url)
    return Response(content=svg, media_type="image/svg+xml")


@app.get(
    "/api/qr",
    summary="Прямая генерация SVG QR-кода для любого валидного URL",
    response_class=Response,
    responses={
        200: {"content": {"image/svg+xml": {}}, "description": "SVG с QR-кодом"},
    },
    tags=["Public Viewer"],
)
def generate_generic_qr(url: str = Query(..., description="URL для кодирования")):
    try:
        target_url = validate_http_url(url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    svg = render_qr_svg(target_url)
    return Response(content=svg, media_type="image/svg+xml")


# =============================================================================
# 5. 📸 PANORAMAS (360° Фото)
# =============================================================================

@app.post(
    "/api/panoramas/upload",
    response_model=schemas.PanoramaUploadResponse,
    summary="Загрузка панорамного 360° фото и авто-генерация миниатюры Pillow",
    tags=["Panoramas"],
)
async def upload_panorama(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не передан")

    ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp", ".jfif", ".bmp", ".heic", ".heif"]
    if ext not in allowed_exts:
        ext = ".jpg"

    unique_name = f"pano_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(PANORAMAS_DIR, unique_name)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    thumb_name = f"thumb_{unique_name}.jpg"
    thumb_path = os.path.join(THUMBS_DIR, thumb_name)
    try:
        create_image_thumbnail(dest_path, thumb_path, size=(400, 200))
    except Exception as e:
        print(f"Thumbnail generation warning: {e}")
        thumb_name = unique_name

    image_url = f"/static/uploads/panoramas/{unique_name}"
    thumb_url = f"/static/uploads/panoramas/thumbs/{thumb_name}"

    return schemas.PanoramaUploadResponse(image_url=image_url, thumbnail_url=thumb_url)


# =============================================================================
# 6. 📍 POINTS OF INTEREST (POI)
# =============================================================================

@app.post(
    "/api/pois",
    response_model=schemas.POIResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создание отдельной точки интереса (POI)",
    tags=["POIs"],
)
def create_poi(payload: schemas.POICreate, db: Session = Depends(get_db)):
    poi = models.POI(
        space_id=payload.space_id,
        floor_id=payload.floor_id,
        title=payload.title.strip(),
        category=payload.category,
        description=payload.description or "",
        x=payload.x,
        y=payload.y,
        room_id=payload.room_id,
        panorama_id=payload.panorama_id,
    )
    db.add(poi)
    db.commit()
    db.refresh(poi)
    return poi


@app.get(
    "/api/pois",
    response_model=List[schemas.POIResponse],
    summary="Список точек интереса",
    tags=["POIs"],
)
def list_pois(space_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.POI)
    if space_id:
        query = query.filter(models.POI.space_id == space_id)
    return query.all()


@app.delete(
    "/api/pois/{poi_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление точки интереса",
    tags=["POIs"],
)
def delete_poi(poi_id: str, db: Session = Depends(get_db)):
    poi = db.query(models.POI).filter(models.POI.id == poi_id).first()
    if not poi:
        raise HTTPException(status_code=404, detail="Точка интереса не найдена")
    db.delete(poi)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =============================================================================
# 7. 📸 PANORAMA 180° + 180° STITCHING ENDPOINT
# =============================================================================

@app.post(
    "/api/stitch",
    summary="Сшивка двух кадров по 180° в цилиндрическую 360° 8K панораму",
    tags=["Panoramas"],
)
async def stitch_panorama_endpoint(
    frame1: UploadFile = File(...),
    frame2: UploadFile = File(...),
):
    """
    Принимает два снимка (180° + 180°) зала с перекрытием,
    сшивает их с помощью алгоритма SIFT + RANSAC + Multiband Feathering
    и возвращает изображение высокого разрешения (8K).
    """
    if stitch_to_8k is None:
        raise HTTPException(
            status_code=500,
            detail="Модуль сшивки панорам (stitch_panorama) недоступен на сервере"
        )

    tmp_dir = tempfile.mkdtemp(prefix="stitch_")
    try:
        ext1 = Path(frame1.filename or "f1.jpg").suffix or ".jpg"
        ext2 = Path(frame2.filename or "f2.jpg").suffix or ".jpg"
        p1 = Path(tmp_dir) / f"frame1{ext1}"
        p2 = Path(tmp_dir) / f"frame2{ext2}"
        p_out = Path(tmp_dir) / "stitched_8k.jpg"

        content1 = await frame1.read()
        content2 = await frame2.read()
        p1.write_bytes(content1)
        p2.write_bytes(content2)

        # Выполняем вычисления в пуле потоков
        await run_in_threadpool(stitch_to_8k, str(p1), str(p2), str(p_out))

        if not p_out.exists():
            raise HTTPException(status_code=500, detail="Ошибка при генерации сшитого файла")

        out_bytes = p_out.read_bytes()
        b64 = base64.b64encode(out_bytes).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{b64}"

        # Сохраняем в постоянное хранилище статики
        perm_filename = f"stitched_{uuid.uuid4().hex[:12]}.jpg"
        perm_path = PANORAMAS_DIR / perm_filename
        perm_path.write_bytes(out_bytes)
        perm_url = f"/static/uploads/panoramas/{perm_filename}"

        return {
            "status": "ok",
            "image": data_uri,
            "url": perm_url,
            "size": len(out_bytes),
            "width": 8192,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

