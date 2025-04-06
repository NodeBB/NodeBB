-- output:
-- +---------------------------------------------+
-- | d                                           |
-- +---------------------------------------------+
-- | {"age": 25, "name": "Alice", "price": null} |
-- +---------------------------------------------+
SELECT JSON_OBJECTAGG(f.field, h.value) AS d
FROM (
    SELECT JSON_UNQUOTE(JSON_EXTRACT(f.value, '$[0]')) AS field
    FROM JSON_TABLE(
        '["name","age","price"]',
        '$[*]' COLUMNS (value JSON PATH '$')
    ) f
) f
LEFT JOIN (
    SELECT 
        JSON_UNQUOTE(k.k) AS `key`,
        JSON_EXTRACT(h.data, CONCAT('$.', k.k)) AS value
    FROM legacy_hash h
    INNER JOIN legacy_object_live o
        ON o._key = h._key
        AND o.type = h.type
    CROSS JOIN JSON_TABLE(
        JSON_KEYS(h.data),
        '$[*]' COLUMNS (k JSON PATH '$')
    ) k
    WHERE o._key = 'key1'
) h
ON h.key = f.field;

-- output:
-- +------------------------------+
-- | d                            |
-- +------------------------------+
-- | {"age": 25, "name": "Alice"} |
-- +------------------------------+
SELECT 
    COALESCE(JSON_OBJECTAGG(t.key, t.value)) AS d
FROM (
    SELECT
        JSON_UNQUOTE(jt.k) AS 'key',
        JSON_EXTRACT(f.data, CONCAT('$.', jt.k)) AS 'value'
    FROM (
        SELECT h.data AS 'data'
        FROM legacy_object_live o
        INNER JOIN legacy_hash h
            ON o._key = h._key
            AND o.type = h.type
        WHERE o._key = 'key1'
        LIMIT 1
    ) f
    CROSS JOIN JSON_TABLE(
        JSON_KEYS(f.data),
        '$[*]' COLUMNS (k JSON PATH '$')
    ) jt
    WHERE jt.k IN ('name', 'age', 'price')
) t;