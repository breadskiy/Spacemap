# SpaceMap — Интерактивная навигация и 2D CAD редактор планов

Веб-платформа для создания поэтажных планов зданий, расстановки зон и точек интереса (POI), загрузки и автоматической сшивки 360° панорам, генерации QR-кодов и интерактивной навигации посетителей прямо в браузере без установки сторонних приложений.

---

## 🚀 Основные возможности

- **Векторный 2D CAD редактор:** построение стен, углов, зонирование помещений с автоматическим замыканием контуров и расчётом площади.
- **Адаптация под смартфоны:** специализированное нижнее плавающее меню инструментов (Bottom Sheet), удобные жесты панорамирования одним пальцем, увеличенные области касания для точного построения на сенсорных экранах.
- **Точки интереса (POI):** размещение стендов, выходов, санузлов, инфостоек и интерактивный поиск по объектам.
- **360° виртуальные туры:** загрузка сферических фото или быстрая сшивка двух кадров по 180° с помощью OpenCV (SIFT + RANSAC + Multiband Feathering) прямо на сервере.
- **QR-коды и мгновенный доступ:** каждый план получает уникальную ссылку и QR-код для посетителей.
- **Полноценная изоляция пользователей:** личный кабинет организатора с JWT-авторизацией, разделением «Мои карты» и публичного каталога мероприятий.

---

## 🛠 Технологический стек

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Canvas API, Marzipano WebGL Viewer
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, Pydantic, Pillow, Pillow-HEIF, OpenCV (Headless), PyJWT
- **База данных:** PostgreSQL 15+
- **Развертывание:** Docker, Docker Compose, Nginx

---

## 📂 Структура репозитория

```text
SpaceMap/
├── backend/                # REST API сервер (FastAPI)
│   ├── main.py             # Точки входа API и маршруты (включая /api/stitch)
│   ├── stitch_panorama.py  # Серверный модуль сшивки 180°+180° в 8K JPEG
│   ├── auth.py             # Авторизация и JWT-токены
│   ├── database.py         # Подключение к PostgreSQL
│   ├── models.py           # SQLAlchemy ORM-модели
│   ├── schemas.py          # Pydantic схемы валидации
│   ├── qr.py               # Генератор QR-кодов
│   ├── requirements.txt    # Зависимости Python
│   ├── Dockerfile          # Docker-образ бэкенда
│   └── static/             # Хранилище загруженных панорам и превью
│
├── frontend/               # Клиентское веб-приложение (React + Vite)
│   ├── src/                # Исходный код интерфейса, редактора и навигатора
│   ├── nginx.conf          # Nginx-конфигурация для продакшена
│   ├── Dockerfile          # Multi-stage сборка React + Nginx
│   ├── package.json        # Зависимости Node.js
│   └── vite.config.ts      # Конфигурация Vite для локальной разработки
│
├── database/               # SQL-скрипты
│   └── schema.sql          # Инициализация таблиц базы данных
│
├── docker-compose.yml      # Развертывание всего стека (PostgreSQL + API + Web)
├── .env.example            # Пример переменных окружения
├── run_project.bat         # Скрипт запуска проекта в один клик (Windows)
└── README.md
```

---

## ⚡ Развертывание на сервере (Aeza VPS / Ubuntu / Debian)

Самый быстрый и надежный способ запустить проект на VPS от Aeza — использовать Docker Compose:

### 1. Подготовка сервера
Подключитесь к вашему серверу Aeza по SSH и установите Docker и Docker Compose:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl

# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

### 2. Клонирование репозитория
```bash
git clone https://github.com/ВАШ_АККАУНТ/SpaceMap.git
cd SpaceMap
```

### 3. Настройка переменных окружения
```bash
cp .env.example .env
nano .env  # Укажите надежный пароль к базе данных POSTGRES_PASSWORD
```

### 4. Запуск проекта
```bash
docker compose up -d --build
```
После завершения сборки:
- Веб-сайт доступен по IP-адресу вашего сервера: `http://IP_ВАШЕГО_СЕРВЕРА`
- Документация API (Swagger): `http://IP_ВАШЕГО_СЕРВЕРА/docs`
- Контейнеры автоматически перезапускаются при перезагрузке сервера.

### 5. Подключение домена и SSL (HTTPS)
Если у вас есть домен, направьте `A`-запись на IP сервера Aeza и установите SSL-сертификат Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 💻 Локальный запуск для разработки

### Под Windows (в 1 клик)
Просто запустите файл `run_project.bat`. Он автоматически проверит PostgreSQL, запустит бэкенд на порту 8000 и откроет фронтенд на порту 5173.

### Ручной запуск
1. **База данных PostgreSQL:**
   ```bash
   psql -U postgres -d indoor_maps -f database/schema.sql
   ```

2. **Бэкенд:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn main:app --reload --port 8000
   ```

3. **Фронтенд:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Веб-интерфейс будет доступен по адресу: `http://localhost:5173`
