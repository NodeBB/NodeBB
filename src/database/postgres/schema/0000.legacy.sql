START TRANSACTION;

DO $$
BEGIN

IF EXISTS(SELECT 1
            FROM "information_schema"."columns"
           WHERE "table_schema" = 'public'
             AND "table_name" = 'legacy_hash'
             AND "column_name" = 'data') THEN
	RETURN;
END IF;

CREATE TYPE LEGACY_OBJECT_TYPE AS ENUM (
	'hash', 'zset', 'set', 'list', 'string'
);

CREATE TABLE "legacy_object" (
	"_key" TEXT NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL,
	"expireAt" TIMESTAMPTZ DEFAULT NULL
) WITHOUT OIDS;

CREATE TABLE "legacy_hash" (
	"_key" TEXT NOT NULL,
	"data" JSONB NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL DEFAULT 'hash' CHECK ("type" = 'hash')
) WITHOUT OIDS;

CREATE TABLE "legacy_zset" (
	"_key" TEXT NOT NULL,
	"value" TEXT NOT NULL,
	"score" NUMERIC NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL DEFAULT 'zset' CHECK ("type" = 'zset')
) WITHOUT OIDS;

CREATE TABLE "legacy_set" (
	"_key" TEXT NOT NULL,
	"member" TEXT NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL DEFAULT 'set' CHECK ("type" = 'set')
) WITHOUT OIDS;

CREATE TABLE "legacy_list" (
	"_key" TEXT NOT NULL,
	"array" TEXT[] NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL DEFAULT 'list' CHECK ("type" = 'list')
) WITHOUT OIDS;

CREATE TABLE "legacy_string" (
	"_key" TEXT NOT NULL,
	"data" TEXT NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL DEFAULT 'string' CHECK ("type" = 'string')
) WITHOUT OIDS;

IF EXISTS(SELECT 1
            FROM "information_schema"."columns"
           WHERE "table_schema" = 'public'
             AND "table_name" = 'objects'
             AND "column_name" = 'data') THEN

INSERT INTO "legacy_object" ("_key", "type", "expireAt")
SELECT DISTINCT "data"->>'_key',
                CASE WHEN (SELECT COUNT(*)
                             FROM jsonb_object_keys("data" - 'expireAt')) = 2
                     THEN CASE WHEN ("data" ? 'value')
                                 OR ("data" ? 'data')
                               THEN 'string'
                               WHEN "data" ? 'array'
                               THEN 'list'
                               WHEN "data" ? 'members'
                               THEN 'set'
                               ELSE 'hash'
                          END
                     WHEN (SELECT COUNT(*)
                             FROM jsonb_object_keys("data" - 'expireAt')) = 3
                     THEN CASE WHEN ("data" ? 'value')
                                AND ("data" ? 'score')
                               THEN 'zset'
                               ELSE 'hash'
                          END
                     ELSE 'hash'
                END::LEGACY_OBJECT_TYPE,
                CASE WHEN ("data" ? 'expireAt')
                     THEN to_timestamp(("data"->>'expireAt')::double precision / 1000)
                     ELSE NULL
                END
  FROM "objects";

INSERT INTO "legacy_hash" ("_key", "data")
SELECT "data"->>'_key',
       "data" - '_key' - 'expireAt'
  FROM "objects"
 WHERE CASE WHEN (SELECT COUNT(*)
                    FROM jsonb_object_keys("data" - 'expireAt')) = 2
            THEN NOT (("data" ? 'value')
                   OR ("data" ? 'data')
                   OR ("data" ? 'members')
                   OR ("data" ? 'array'))
            WHEN (SELECT COUNT(*)
                    FROM jsonb_object_keys("data" - 'expireAt')) = 3
            THEN NOT (("data" ? 'value')
                  AND ("data" ? 'score'))
            ELSE TRUE
       END;

INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT "data"->>'_key',
       "data"->>'value',
       ("data"->>'score')::NUMERIC
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 3
   AND ("data" ? 'value')
   AND ("data" ? 'score');

INSERT INTO "legacy_set" ("_key", "member")
SELECT "data"->>'_key',
       jsonb_array_elements_text("data"->'members')
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND ("data" ? 'members');

INSERT INTO "legacy_list" ("_key", "array")
SELECT "data"->>'_key',
       ARRAY(SELECT t
               FROM jsonb_array_elements_text("data"->'list') WITH ORDINALITY l(t, i)
              ORDER BY i ASC)
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND ("data" ? 'array');

INSERT INTO "legacy_string" ("_key", "data")
SELECT "data"->>'_key',
       CASE WHEN "data" ? 'value'
            THEN "data"->>'value'
            ELSE "data"->>'data'
       END
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND (("data" ? 'value')
     OR ("data" ? 'data'));

DROP TABLE "objects" CASCADE;
DROP FUNCTION "fun__objects__expireAt"() CASCADE;

END IF;

ALTER TABLE "legacy_object"
	ADD PRIMARY KEY ("_key"),
	CLUSTER ON "legacy_object_pkey";
CREATE UNIQUE INDEX ON "legacy_object"("_key", "type");
CREATE INDEX "idx__legacy_object__expireAt" ON "legacy_object"("expireAt" ASC);

ANALYZE "legacy_object";

CREATE VIEW "legacy_object_live" AS
SELECT "_key", "type"
  FROM "legacy_object"
 WHERE "expireAt" IS NULL
    OR "expireAt" > CURRENT_TIMESTAMP;

ALTER TABLE "legacy_hash"
	ADD PRIMARY KEY ("_key"),
	CLUSTER ON "legacy_hash_pkey",
	ADD CONSTRAINT "fk__legacy_hash__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE;

ALTER TABLE "legacy_zset"
	ADD PRIMARY KEY ("_key", "value"),
	CLUSTER ON "legacy_zset_pkey",
	ADD CONSTRAINT "fk__legacy_zset__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE;
CREATE INDEX "idx__legacy_zset__key__score" ON "legacy_zset"("_key" ASC, "score" DESC);

ALTER TABLE "legacy_set"
	ADD PRIMARY KEY ("_key", "member"),
	CLUSTER ON "legacy_set_pkey",
	ADD CONSTRAINT "fk__legacy_set__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE;

ALTER TABLE "legacy_list"
	ADD PRIMARY KEY ("_key"),
	CLUSTER ON "legacy_list_pkey",
	ADD CONSTRAINT "fk__legacy_list__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE;

ALTER TABLE "legacy_string"
	ADD PRIMARY KEY ("_key"),
	CLUSTER ON "legacy_string_pkey",
	ADD CONSTRAINT "fk__legacy_string__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE;

ANALYZE "legacy_hash";
ANALYZE "legacy_zset";
ANALYZE "legacy_set";
ANALYZE "legacy_list";
ANALYZE "legacy_string";

END;
$$ LANGUAGE plpgsql;

COMMIT;
