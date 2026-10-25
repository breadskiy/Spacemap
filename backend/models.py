import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON, Uuid
from sqlalchemy.orm import relationship

try:
    from database import Base
except ImportError:
    from backend.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    email = Column(String(320), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False, default="")
    company = Column(String(255), nullable=False, default="")
    role = Column(String(50), nullable=False, default="organizer")  # 'organizer' | 'admin' | 'partner'
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    spaces = relationship("Space", back_populates="owner", cascade="all, delete-orphan")


class Space(Base):
    __tablename__ = "spaces"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    owner_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(50), nullable=False, default="conference")  # 'exhibition' | 'conference' | 'office' | 'mall' | 'other'
    address = Column(String(500), nullable=False, default="Адрес не указан")
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="draft")  # 'draft' | 'published'
    floors_count = Column(Integer, nullable=False, default=1)
    walls_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="spaces")
    plan_versions = relationship("PlanVersion", back_populates="space", cascade="all, delete-orphan", order_by="desc(PlanVersion.version)")
    pois = relationship("POI", back_populates="space", cascade="all, delete-orphan")
    panoramas = relationship("Panorama", back_populates="space", cascade="all, delete-orphan")


class PlanVersion(Base):
    """Хранит версии 2D-чертежа (PlanData) в формате JSONB."""
    __tablename__ = "plan_versions"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    space_id = Column(Uuid(as_uuid=False), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    status = Column(String(50), nullable=False, default="draft")  # 'draft' | 'published' | 'archived'
    data = Column(JSON, nullable=False)  # Полный PlanData (floors, corners, walls, rooms, pois, panoramas)
    created_by = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)

    # Relationships
    space = relationship("Space", back_populates="plan_versions")


class POI(Base):
    __tablename__ = "pois"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    space_id = Column(Uuid(as_uuid=False), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_id = Column(String(50), nullable=False, default="floor-1")
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="stand")
    description = Column(Text, nullable=True)
    x = Column(Float, nullable=False, default=0.0)  # Абсолютные координаты на плане (px)
    y = Column(Float, nullable=False, default=0.0)
    room_id = Column(String(100), nullable=True)
    panorama_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    space = relationship("Space", back_populates="pois")


class Panorama(Base):
    __tablename__ = "panoramas"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    space_id = Column(Uuid(as_uuid=False), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_id = Column(String(50), nullable=False, default="floor-1")
    title = Column(String(255), nullable=False)
    image_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    x = Column(Float, nullable=False, default=0.0)  # Абсолютные координаты на плане (px)
    y = Column(Float, nullable=False, default=0.0)
    view_angle = Column(Float, nullable=False, default=0.0)
    room_id = Column(String(100), nullable=True)
    connections = Column(JSON, nullable=True)  # Переходы на другие панорамы
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    space = relationship("Space", back_populates="panoramas")
