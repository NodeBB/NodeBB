DO $functions$
BEGIN

IF EXISTS(SELECT 1
            FROM "information_schema"."routines"
           WHERE "routine_schema" = 'public'
             AND "routine_name" = 'object_getType') THEN
	RETURN;
END IF;

CREATE FUNCTION "object_getType"("@_key" TEXT) RETURNS LEGACY_OBJECT_TYPE AS $$
DECLARE
	"@type" LEGACY_OBJECT_TYPE;
BEGIN
	SELECT "type" INTO "@type"
	  FROM "legacy_object_live"
	 WHERE "_key" = "@_key";

	RETURN "@type";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "object_ensureType"("@_key" TEXT, "@type" LEGACY_OBJECT_TYPE) RETURNS void AS $$
DECLARE
	"@actual_type" LEGACY_OBJECT_TYPE;
BEGIN
	INSERT INTO "legacy_object" ("_key", "type")
	VALUES ("@_key", "@type") ON CONFLICT DO NOTHING;

	SELECT "object_getType"("@_key") INTO "@actual_type";

	IF "@actual_type" <> "@type" THEN
		RAISE EXCEPTION 'Cannot insert % as % because it already exists as %.', TO_JSONB("@_key")::TEXT, "@type", "@actual_type";
	END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "delete_all_data_from_database"() RETURNS void AS $$
BEGIN
	DELETE FROM "legacy_object";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "object_exists"("@_key" TEXT) RETURNS BOOLEAN AS $$
BEGIN
	RETURN EXISTS(SELECT 1
	                FROM "legacy_object_live"
	               WHERE "_key" = "@_key"
	               LIMIT 1);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "object_delete"("@_key" TEXT) RETURNS void AS $$
BEGIN
	DELETE FROM "legacy_object"
	 WHERE "_key" = "@_key";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "object_expireAt"("@_key" TEXT, "@expireAt" TIMESTAMPTZ) RETURNS void AS $$
BEGIN
	UPDATE "legacy_object"
	   SET "expireAt" = "@expireAt"
	 WHERE "_key" = "@_key";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "object_flushExpired"() RETURNS void AS $$
BEGIN
	DELETE FROM "legacy_object"
	 WHERE "expireAt" IS NOT NULL
	   AND "expireAt" <= CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "object_rename"("@_oldKey" TEXT, "@_newKey" TEXT) RETURNS void AS $$
BEGIN
	UPDATE "legacy_object"
	   SET "_key" = "@_newKey"
	 WHERE "_key" = "@_oldKey";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "hash_setObject"("@_key" TEXT, "@data" JSONB) RETURNS void AS $$
BEGIN
	PERFORM "object_ensureType"("@_key", 'hash');

	INSERT INTO "legacy_hash" ("_key", "data")
	VALUES ("@_key", "@data")
	    ON CONFLICT ("_key")
	    DO UPDATE SET "data" = "legacy_hash"."data" || "@data";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "hash_getObject"("@_key" TEXT) RETURNS JSONB AS $$
DECLARE
	"@data" JSONB;
BEGIN
	SELECT h."data" INTO "@data"
	  FROM "legacy_object_live" o
	 INNER JOIN "legacy_hash" h
	         ON o."_key" = h."_key"
	        AND o."type" = h."type"
	 WHERE o."_key" = "@_key"
	 LIMIT 1;

	RETURN "@data";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "hash_filterObject"("@data" JSONB, "@fields" TEXT[]) RETURNS JSONB AS $$
BEGIN
	RETURN COALESCE((SELECT JSONB_OBJECT_AGG("@field", "@data"->>"@field")
	                   FROM UNNEST("@fields") f("@field")), '{}');
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "hash_deleteObjectFields"("@_key" TEXT, "@fields" TEXT[]) RETURNS void AS $$
BEGIN
	UPDATE "legacy_hash"
	   SET "data" = COALESCE((SELECT jsonb_object_agg("key", "value")
	                            FROM jsonb_each("data")
	                           WHERE "key" <> ALL ("@fields")), '{}')
         WHERE "_key" = "@_key";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "hash_incrObjectField"("@_key" TEXT, "@field" TEXT, "@amount" NUMERIC) RETURNS NUMERIC AS $$
DECLARE
	"@current" NUMERIC;
BEGIN
	PERFORM "object_ensureType"("@_key", 'hash');

	INSERT INTO "legacy_hash" ("_key", "data")
	VALUES ("@_key", JSONB_BUILD_OBJECT("@field", "@amount"))
	    ON CONFLICT ("_key")
	    DO UPDATE SET "data" = JSONB_SET("legacy_hash"."data", ARRAY["@field"], TO_JSONB(COALESCE(("legacy_hash"."data"->>"@field")::NUMERIC, 0) + "@amount"))
	RETURNING ("data"->>"@field") INTO "@current";

	RETURN "@current";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_addItem"("@_key" TEXT, "@value" TEXT, "@score" NUMERIC) RETURNS void AS $$
BEGIN
	PERFORM "object_ensureType"("@_key", 'zset');

	INSERT INTO "legacy_zset" ("_key", "value", "score")
	VALUES ("@_key", "@value", "@score")
	    ON CONFLICT ("_key", "value")
	    DO UPDATE SET "score" = "@score";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_removeItem"("@_key" TEXT, "@value" TEXT) RETURNS void AS $$
BEGIN
	DELETE FROM "legacy_zset"
	 WHERE "_key" = "@_key"
	   AND "value" = "@value";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_removeItemsByScore"("@_key" TEXT, "@min" NUMERIC, "@max" NUMERIC) RETURNS void AS $$
BEGIN
	DELETE FROM "legacy_zset"
	 WHERE "_key" = "@_key"
	   AND ("score" >= "@min" OR "@min" IS NULL)
	   AND ("score" <= "@max" OR "@max" IS NULL);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_getAllItems"("@_key" TEXT, OUT "value" TEXT, OUT "score" NUMERIC) RETURNS SETOF record AS $$
BEGIN
	RETURN QUERY SELECT z."value", z."score"
	               FROM "legacy_object_live" o
	              INNER JOIN "legacy_zset" z
	                      ON o."_key" = z."_key"
	                     AND o."type" = z."type"
	              WHERE o."_key" = "@_key";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_getScore"("@_key" TEXT, "@value" TEXT) RETURNS NUMERIC AS $$
BEGIN
	RETURN (SELECT z."score"
	          FROM "zset_getAllItems"("@_key") z
	         WHERE z."value" = "@value");
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_getRank"("@_key" TEXT, "@value" TEXT, "@desc" BOOLEAN = FALSE) RETURNS BIGINT AS $$
DECLARE
	"@rank" BIGINT;
BEGIN
	SELECT r INTO "@rank"
	  FROM (SELECT z."value" v, ROW_NUMBER() OVER (ORDER BY z."score" ASC, z."value" ASC) r
	          FROM "zset_getAllItems"("@_key") z) ranks
	 WHERE v = "@value";

	IF "@desc" THEN
		SELECT COUNT(*) - "@rank" INTO "@rank"
		  FROM "zset_getAllItems"("@_key");
	ELSE
		SELECT "@rank" - 1 INTO "@rank";
	END IF;

	RETURN "@rank";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "zset_incrItem"("@_key" TEXT, "@value" TEXT, "@amount" NUMERIC) RETURNS NUMERIC AS $$
DECLARE
	"@current" NUMERIC;
BEGIN
	PERFORM "object_ensureType"("@_key", 'zset');

	INSERT INTO "legacy_zset" ("_key", "value", "score")
	VALUES ("@_key", "@value", "@amount")
	    ON CONFLICT ("_key", "value")
	    DO UPDATE SET "score" = "legacy_zset"."score" + "@amount"
	RETURNING "score" INTO "@current";

	RETURN "@current";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "set_addMember"("@_key" TEXT, "@member" TEXT) RETURNS void AS $$
BEGIN
	PERFORM "object_ensureType"("@_key", 'set');

	INSERT INTO "legacy_set" ("_key", "member")
	VALUES ("@_key", "@member")
	    ON CONFLICT ("_key", "member")
	    DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "set_removeMember"("@_key" TEXT, "@member" TEXT) RETURNS void AS $$
BEGIN
	DELETE FROM "legacy_set"
	 WHERE "_key" = "@_key"
	   AND "member" = "@member";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "set_isMember"("@_key" TEXT, "@member" TEXT) RETURNS BOOLEAN AS $$
BEGIN
	RETURN EXISTS(SELECT 1
	                FROM "legacy_object_live" o
	               INNER JOIN "legacy_set" s
	                       ON o."_key" = s."_key"
	                      AND o."type" = s."type"
	               WHERE o."_key" = "@_key"
	                 AND s."member" = "@member");
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "set_getMembers"("@_key" TEXT) RETURNS TEXT[] AS $$
BEGIN
	RETURN ARRAY(SELECT s."member"
	               FROM "legacy_object_live" o
	              INNER JOIN "legacy_set" s
	                      ON o."_key" = s."_key"
	                     AND o."type" = s."type"
	              WHERE o."_key" = "@_key");
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "list_getValues"("@_key" TEXT) RETURNS TEXT[] AS $$
DECLARE
	"@values" TEXT[];
BEGIN
	SELECT "array" INTO "@values"
	  FROM "legacy_list" l
	 INNER JOIN "legacy_object_live" o
	         ON l."_key" = o."_key"
	        AND l."type" = o."type"
	 WHERE l."_key" = "@_key"
	   FOR UPDATE;

	RETURN "@values";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "list_setValues"("@_key" TEXT, "@values" TEXT[]) RETURNS void AS $$
BEGIN
	PERFORM "object_ensureType"("@_key", 'list');

	INSERT INTO "legacy_list" ("_key", "array")
	VALUES ("@_key", "@values")
	    ON CONFLICT ("_key")
	    DO UPDATE SET "array" = "@values";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "string_getValue"("@_key" TEXT) RETURNS TEXT AS $$
BEGIN
	RETURN (SELECT s."data"
	          FROM "legacy_object_live" o
	         INNER JOIN "legacy_string" s
	                 ON o."_key" = s."_key"
	                AND o."type" = s."type"
	         WHERE o."_key" = "@_key"
	         LIMIT 1);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "string_setValue"("@_key" TEXT, "@data" TEXT) RETURNS void AS $$
BEGIN
	PERFORM "object_ensureType"("@_key", 'string');

	INSERT INTO "legacy_string" ("_key", "data")
	VALUES ("@_key", "@data")
	    ON CONFLICT ("_key")
	    DO UPDATE SET "data" = "@data";
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "string_incrValue"("@_key" TEXT, "@amount" NUMERIC) RETURNS NUMERIC AS $$
DECLARE
	"@current" NUMERIC;
BEGIN
	PERFORM "object_ensureType"("@_key", 'string');

	INSERT INTO "legacy_string" ("_key", "data")
	VALUES ("@_key", "@amount"::TEXT)
	    ON CONFLICT ("_key")
	    DO UPDATE SET "data" = ("legacy_string"."data"::NUMERIC + "@amount")::TEXT
	RETURNING "data"::NUMERIC INTO "@current";

	RETURN "@current";
END;
$$ LANGUAGE plpgsql;

END;
$functions$ LANGUAGE plpgsql;
