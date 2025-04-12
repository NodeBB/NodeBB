WITH KeyList AS (
    SELECT _key, ROW_NUMBER() OVER () AS i
    FROM (SELECT 'key1,key3,key2,key6' AS `keys`) AS k
    JOIN JSON_TABLE(
        REPLACE(CONCAT('["', REPLACE(`keys`, ',', '","'), '"]'), ' ', ''),
        '$[*]' COLUMNS (_key VARCHAR(255) PATH '$')
    ) AS jt
)
SELECT JSON_OBJECT(
    'name', JSON_EXTRACT(h.data, CONCAT('$.', 'name')),
    'age', JSON_EXTRACT(h.data, CONCAT('$.', 'age')),
    'price', JSON_EXTRACT(h.data, CONCAT('$.', 'price'))
) AS d
FROM KeyList k
LEFT JOIN legacy_object_live o ON o._key = k._key
LEFT JOIN legacy_hash h ON h._key = o._key AND h.type = o.type
ORDER BY k.i;

WITH KeyList AS (
    SELECT _key, ROW_NUMBER() OVER () AS i
    FROM JSON_TABLE(
        '["key1", "key3", "key2", "key6"]',
        '$[*]' COLUMNS (_key VARCHAR(255) PATH '$')
    ) AS jt
)
SELECT JSON_OBJECT(
    'name', JSON_EXTRACT(h.data, '$.name'),
    'age', JSON_EXTRACT(h.data, '$.age'),
    'price', JSON_EXTRACT(h.data, '$.price')
) AS d
FROM KeyList k
LEFT JOIN legacy_object_live o ON o._key = k._key
LEFT JOIN legacy_hash h ON h._key = o._key AND h.type = o.type
ORDER BY k.i;

WITH KeyList AS (
    SELECT _key, ROW_NUMBER() OVER () AS i
    FROM JSON_TABLE(
        '["key1", "key3", "key2", "key6"]',
        '$[*]' COLUMNS (_key VARCHAR(255) PATH '$')
    ) AS jt
)
SELECT JSON_OBJECT(
    'name', JSON_EXTRACT(h.data, '$.name'),
    'age', JSON_EXTRACT(h.data, '$.age'),
    'price', JSON_EXTRACT(h.data, '$.price')
) AS d
FROM KeyList k
LEFT JOIN legacy_object_live o ON o._key = k._key
LEFT JOIN legacy_hash h ON h._key = o._key AND h.type = o.type
ORDER BY k.i;

