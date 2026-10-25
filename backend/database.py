import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent

# Переменная окружения для подключения к PostgreSQL.
# Значение берётся из файла .env (который не коммитится в Git) или из системных переменных.
raw_db_url = os.getenv("DATABASE_URL", "").strip()


def ensure_postgres_running(host: str = "127.0.0.1", port: int = 5432) -> bool:
    """Проверяет, запущен ли PostgreSQL локально; если нет — запускает автоматически."""
    import socket
    import subprocess
    import time

    def is_port_open() -> bool:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                return s.connect_ex((host, port)) == 0
        except Exception:
            return False

    if is_port_open():
        return True

    pg_paths = [
        (Path(r"D:\PostgreSQL\bin\pg_ctl.exe"), Path(r"D:\PostgreSQL\data")),
        (Path(r"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"), Path(r"C:\Program Files\PostgreSQL\18\data")),
        (Path(r"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"), Path(r"C:\Program Files\PostgreSQL\17\data")),
        (Path(r"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"), Path(r"C:\Program Files\PostgreSQL\16\data")),
    ]

    for ctl, data in pg_paths:
        if ctl.exists() and data.exists():
            print(f"[SpaceMap] Запуск базы данных PostgreSQL ({ctl.parent})...")
            try:
                subprocess.run(
                    [str(ctl), "start", "-D", str(data), "-w"],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                time.sleep(1)
                if is_port_open():
                    print("[SpaceMap] PostgreSQL запущен и готов принимать подключения!")
                    return True
            except Exception as e:
                print(f"[SpaceMap] Предупреждение автозапуска PostgreSQL: {e}")

    return is_port_open()


# Если адрес указывает на локальный PostgreSQL, проверяем и при необходимости запускаем
if "127.0.0.1" in raw_db_url or "localhost" in raw_db_url:
    ensure_postgres_running()

# Нормализуем протокол для SQLAlchemy (postgres:// -> postgresql://)
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

if raw_db_url:
    SQLALCHEMY_DATABASE_URL = raw_db_url
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
    )
else:
    # Локальный fallback на SQLite при разработке без запущенного PostgreSQL
    DB_PATH = BASE_DIR / "indoor_maps.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
