-- =============================================================================
-- SpaceMap — 2D CAD & Indoor Navigation Database Schema
-- СУБД: PostgreSQL 14+
-- База данных: indoor_maps
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Пользователи / Организаторы (users)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text        NOT NULL,
    password_hash text        NOT NULL,
    display_name  text        NOT NULL DEFAULT '',
    company       text        NOT NULL DEFAULT '',
    role          text        NOT NULL DEFAULT 'organizer',
    is_active     boolean     NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_email_not_blank CHECK (btrim(email) <> ''),
    CONSTRAINT users_email_has_at CHECK (position('@' in email) > 1),
    CONSTRAINT users_password_hash_not_blank CHECK (btrim(password_hash) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email));

-- -----------------------------------------------------------------------------
-- 2. Пространства / Площадки (spaces)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS spaces (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid        REFERENCES users (id) ON DELETE SET NULL,
    title         text        NOT NULL,
    slug          text        NOT NULL UNIQUE,
    category      text        NOT NULL DEFAULT 'conference',
    address       text        NOT NULL DEFAULT '',
    description   text        NOT NULL DEFAULT '',
    status        text        NOT NULL DEFAULT 'draft',
    floors_count  int         NOT NULL DEFAULT 1,
    walls_count   int         NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT spaces_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT spaces_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS spaces_owner_idx ON spaces (owner_id);
CREATE INDEX IF NOT EXISTS spaces_slug_idx ON spaces (slug);

-- -----------------------------------------------------------------------------
-- 3. Версии 2D CAD-плана этажей (plan_versions)
--    data JSONB хранит всю векторную геометрию: floors, walls, corners, rooms, pois
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plan_versions (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id      uuid        NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    version       int         NOT NULL DEFAULT 1,
    status        text        NOT NULL DEFAULT 'draft',
    data          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_by    uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    published_at  timestamptz,

    CONSTRAINT plan_versions_status_check CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT plan_versions_unique_ver UNIQUE (space_id, version)
);

CREATE INDEX IF NOT EXISTS plan_versions_space_idx ON plan_versions (space_id, version DESC);

-- -----------------------------------------------------------------------------
-- 4. Точки интереса (pois) — стенды, входы, инфостойки
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pois (
    id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id      uuid             NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    floor_id      text             NOT NULL DEFAULT 'floor-1',
    title         text             NOT NULL,
    category      text             NOT NULL DEFAULT 'stand',
    description   text             NOT NULL DEFAULT '',
    x             double precision NOT NULL DEFAULT 0.0,
    y             double precision NOT NULL DEFAULT 0.0,
    room_id       text,
    panorama_id   uuid,
    created_at    timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pois_space_idx ON pois (space_id);

-- -----------------------------------------------------------------------------
-- 5. 360-градусные панорамы (panoramas)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS panoramas (
    id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id      uuid             NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    floor_id      text             NOT NULL DEFAULT 'floor-1',
    title         text             NOT NULL,
    image_url     text             NOT NULL,
    thumbnail_url text,
    x             double precision NOT NULL DEFAULT 0.0,
    y             double precision NOT NULL DEFAULT 0.0,
    view_angle    double precision NOT NULL DEFAULT 0.0,
    room_id       text,
    connections   jsonb            DEFAULT '[]'::jsonb,
    created_at    timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS panoramas_space_idx ON panoramas (space_id);

-- -----------------------------------------------------------------------------
-- 6. Триггеры обновления updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_spaces_touch ON spaces;
CREATE TRIGGER trg_spaces_touch
    BEFORE UPDATE ON spaces
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_plan_versions_touch ON plan_versions;
CREATE TRIGGER trg_plan_versions_touch
    BEFORE UPDATE ON plan_versions
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
