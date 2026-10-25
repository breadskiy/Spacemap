import io
import os
from urllib.parse import urlsplit


def build_viewer_url(base_url: str, space_id: str, slug: str = "") -> str:
    """Генерирует публичный URL просмотра карты для посетителей.
    
    По умолчанию пытается взять FRONTEND_URL из переменных окружения (например, http://localhost:5173).
    Если не задан, формирует веб-ссылку /?view={space_id}.
    """
    frontend_base = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not frontend_base:
        # Если фронтенд хостится на том же домене или локально
        frontend_base = base_url.rstrip("/")
    
    return f"{frontend_base}/?view={space_id}"


def validate_http_url(url: str) -> str:
    """Проверяет, что для QR передан абсолютный http(s)-URL."""
    value = url.strip()
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL должен быть абсолютным адресом http:// или https://")
    return value


def render_qr_svg(data: str, *, box_size: int = 10, border: int = 2) -> str:
    """Рендерит строку в SVG QR-код без записи на диск."""
    import qrcode
    import qrcode.image.svg

    image = qrcode.make(
        data,
        image_factory=qrcode.image.svg.SvgPathImage,
        box_size=box_size,
        border=border,
    )
    buffer = io.BytesIO()
    image.save(buffer)
    return buffer.getvalue().decode("utf-8")
