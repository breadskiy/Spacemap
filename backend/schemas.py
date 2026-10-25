from typing import Any, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


# ==========================================
# Базовая модель с поддержкой camelCase и snake_case
# ==========================================

class BaseCamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ==========================================
# Auth Schemas
# ==========================================

class UserRegister(BaseCamelModel):
    email: str = Field(..., description="Email пользователя")
    password: str = Field(..., min_length=4, description="Пароль")
    name: str = Field(..., description="Имя пользователя")
    company: Optional[str] = Field("", description="Название компании")
    role: Optional[Literal["organizer", "admin", "partner"]] = Field("organizer", description="Роль пользователя")


class UserLogin(BaseCamelModel):
    email: str = Field(..., description="Email")
    password: str = Field(..., description="Пароль")


class UserResponse(BaseCamelModel):
    id: str
    email: str
    name: str = ""
    display_name: str = ""
    company: str = ""
    role: str = "organizer"


class UserUpdate(BaseCamelModel):
    name: Optional[str] = None
    company: Optional[str] = None
    password: Optional[str] = None


class TokenResponse(BaseCamelModel):
    access_token: str = Field(..., alias="accessToken")
    token_type: str = Field("bearer", alias="tokenType")
    user: UserResponse


# ==========================================
# 2D CAD Plan Schemas (Геометрия этажей)
# ==========================================

class PlanCornerSchema(BaseCamelModel):
    id: str
    x: float
    y: float


class PlanWallSchema(BaseCamelModel):
    id: str
    from_corner: str = Field(..., alias="from", description="ID начальной точки")
    to_corner: str = Field(..., alias="to", description="ID конечной точки")
    length: Optional[float] = None


class PlanRoomSchema(BaseCamelModel):
    id: str
    name: str
    color: str = "#3b82f6"
    corners: List[str] = Field(default_factory=list, description="Список ID углов полигона")


class PlanPoiSchema(BaseModel):
    id: str
    name: str
    category: str = "stand"
    x: float
    y: float
    description: Optional[str] = ""
    room_id: Optional[str] = None
    roomId: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unify_room_id(cls, data: Any):
        if isinstance(data, dict):
            rid = data.get("room_id") or data.get("roomId")
            data["room_id"] = rid
            data["roomId"] = rid
        return data


class PlanPanoramaHotspotSchema(BaseModel):
    id: str
    name: str
    category: str = "stand"
    yaw: float = 0.0
    pitch: Optional[float] = 0.0


class PlanPanoramaSchema(BaseModel):
    id: str
    name: str
    x: float
    y: float
    room_id: Optional[str] = None
    roomId: Optional[str] = None
    image: Optional[str] = None
    image_data: Optional[str] = None
    imageData: Optional[str] = None
    view_angle: Optional[float] = 0.0
    viewAngle: Optional[float] = 0.0
    hotspots: Optional[List[PlanPanoramaHotspotSchema]] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def unify_pano(cls, data: Any):
        if isinstance(data, dict):
            rid = data.get("room_id") or data.get("roomId")
            data["room_id"] = rid
            data["roomId"] = rid
            img = data.get("image_data") or data.get("imageData") or data.get("image")
            data["image_data"] = img
            data["imageData"] = img
            if "image" not in data or not data["image"]:
                data["image"] = img
            va = data.get("view_angle") if data.get("view_angle") is not None else data.get("viewAngle", 0.0)
            data["view_angle"] = va
            data["viewAngle"] = va
        return data


class PlanFloorSchema(BaseCamelModel):
    id: str = "floor-1"
    name: str = "1 этаж"
    level: int = 1
    height: Optional[float] = 3.5
    corners: List[PlanCornerSchema] = Field(default_factory=list)
    walls: List[PlanWallSchema] = Field(default_factory=list)
    rooms: List[PlanRoomSchema] = Field(default_factory=list)
    pois: List[PlanPoiSchema] = Field(default_factory=list)
    panoramas: List[PlanPanoramaSchema] = Field(default_factory=list)


class PlanDataSchema(BaseCamelModel):
    floors: List[PlanFloorSchema] = Field(default_factory=list)


# ==========================================
# Space (Пространства / Объекты)
# ==========================================

SpaceCategory = Literal['exhibition', 'conference', 'office', 'mall', 'other']

CATEGORY_LABELS: dict[str, str] = {
    'exhibition': 'Выставка',
    'conference': 'Конференция',
    'office': 'Бизнес-центр / Офис',
    'mall': 'Торговый комплекс',
    'other': 'Пространство'
}


class SpaceBase(BaseCamelModel):
    title: str = Field(..., description="Название мероприятия или здания")
    category: SpaceCategory = Field("conference", description="Категория")
    address: str = Field("Адрес не указан", description="Физический адрес")
    description: Optional[str] = Field("", description="Описание объекта")


class SpaceCreate(SpaceBase):
    pass


class SpaceUpdate(BaseCamelModel):
    title: Optional[str] = None
    category: Optional[SpaceCategory] = None
    address: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["draft", "published"]] = None


class SpaceResponse(SpaceBase):
    id: str
    user_id: Optional[str] = Field(None, alias="userId")
    userId: Optional[str] = None
    category_label: str = Field("", alias="categoryLabel")
    status: str = "draft"
    floors_count: int = Field(1, alias="floorsCount")
    walls_count: int = Field(0, alias="wallsCount")
    updated_at: str = Field("", alias="updatedAt")
    public_url: Optional[str] = Field(None, alias="publicUrl")

    @model_validator(mode="before")
    @classmethod
    def unify_user_id(cls, data: Any):
        if isinstance(data, dict):
            uid = data.get("userId") or data.get("user_id") or data.get("owner_id")
            data["userId"] = uid
            data["user_id"] = uid
        return data


class SpacePublicResponse(SpaceResponse):
    plan: Optional[PlanDataSchema] = None


# ==========================================
# Panoramas
# ==========================================

class PanoramaUploadResponse(BaseCamelModel):
    image_url: str = Field(..., alias="imageUrl")
    thumbnail_url: str = Field(..., alias="thumbnailUrl")


class PanoramaCreate(BaseCamelModel):
    space_id: str = Field(..., alias="spaceId")
    floor_id: str = Field("floor-1", alias="floorId")
    title: str
    image_url: str = Field(..., alias="imageUrl")
    thumbnail_url: Optional[str] = Field("", alias="thumbnailUrl")
    x: float = 0.0
    y: float = 0.0
    view_angle: float = Field(0.0, alias="viewAngle")
    room_id: Optional[str] = Field(None, alias="roomId")


class PanoramaResponse(PanoramaCreate):
    id: str
    created_at: Optional[str] = Field(None, alias="createdAt")


# ==========================================
# POI (Точки интереса)
# ==========================================

class POICreate(BaseCamelModel):
    space_id: str = Field(..., alias="spaceId")
    floor_id: str = Field("floor-1", alias="floorId")
    title: str
    category: str = "stand"
    description: Optional[str] = ""
    x: float
    y: float
    room_id: Optional[str] = Field(None, alias="roomId")
    panorama_id: Optional[str] = Field(None, alias="panoramaId")


class POIUpdate(BaseCamelModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    room_id: Optional[str] = Field(None, alias="roomId")
    panorama_id: Optional[str] = Field(None, alias="panoramaId")


class POIResponse(POICreate):
    id: str
