-- =====================================================================
-- «Созвездие» — хранилище эмбеддингов стиля (вопрос №2)
-- Нужно расширение pgvector. Его наличие у управляемого PostgreSQL уточнить у хостинга;
-- локально на Windows оно ставится отдельно — поэтому вынесено в отдельную миграцию.
-- Применять, когда дойдёте до сравнения «референсы ↔ портфолио».
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE embedding_entity AS ENUM ('portfolio_item', 'portfolio_media', 'project_reference');

CREATE TABLE style_embeddings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   embedding_entity NOT NULL,
  entity_id     uuid NOT NULL,
  model_version text NOT NULL,          -- при смене модели пересчитываем, старые строки удаляем
  embedding     vector(768) NOT NULL,   -- размерность уточнить под выбранную открытую модель
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, model_version)
);

-- Поиск ближайших по косинусному расстоянию
CREATE INDEX style_embeddings_hnsw ON style_embeddings USING hnsw (embedding vector_cosine_ops);

COMMIT;
