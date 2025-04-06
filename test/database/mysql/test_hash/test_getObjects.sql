-- post process in js to sort and add NULL values
-- output:
-- +------+-----------------------------------------------------------+
-- | _key | data                                                      |
-- +------+-----------------------------------------------------------+
-- | key1 | {"age": 25, "city": "New York", "name": "Alice"}          |
-- | key2 | {"price": 999, "inStock": true, "product": "Laptop"}      |
-- | key3 | {"id": 123, "score": 85.5, "active": false}               |
-- | key4 | {"pages": 300, "title": "Book", "author": "John Doe"}     |
-- | key5 | {"date": "2025-05-01", "event": "Concert", "tickets": 50} |
-- +------+-----------------------------------------------------------+
SELECT o._key, h.data
FROM legacy_object_live o
LEFT OUTER JOIN legacy_hash h
    ON o._key = h._key
    AND o.type = h.type
WHERE o._key IN ("key1","key3","key2","key6","key5","key4");

-- sorting and adding NULL values done in sql
-- output:
-- +-----------------------------------------------------------+
-- | data                                                      |
-- +-----------------------------------------------------------+
-- | {"age": 25, "city": "New York", "name": "Alice"}          |
-- | {"id": 123, "score": 85.5, "active": false}               |
-- | {"price": 999, "inStock": true, "product": "Laptop"}      |
-- | NULL                                                      |
-- | {"date": "2025-05-01", "event": "Concert", "tickets": 50} |
-- | {"pages": 300, "title": "Book", "author": "John Doe"}     |
-- +-----------------------------------------------------------+
WITH RECURSIVE key_list AS (
    SELECT JSON_UNQUOTE(JSON_EXTRACT(t.keys, '$[0]')) AS _key, 1 AS i
    FROM (SELECT '["key1","key3","key2","key6","key5","key4"]' AS `keys`) t
    WHERE JSON_LENGTH(t.keys) > 0
    UNION ALL
    SELECT JSON_UNQUOTE(JSON_EXTRACT(t.keys, CONCAT('$[', kl.i, ']'))) AS _key, kl.i + 1 AS i
    FROM (SELECT '["key1","key3","key2","key6","key5","key4"]' AS `keys`) t
    JOIN key_list kl
    WHERE kl.i < JSON_LENGTH(t.keys)
)
SELECT h.data
FROM key_list k
LEFT OUTER JOIN legacy_object_live o
    ON o._key = k._key
LEFT OUTER JOIN legacy_hash h
    ON o._key = h._key
    AND o.type = h.type
ORDER BY k.i ASC;
