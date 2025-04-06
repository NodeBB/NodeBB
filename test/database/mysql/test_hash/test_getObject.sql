-- output:
-- +--------------------------------------------------+
-- | data                                             |
-- +--------------------------------------------------+
-- | {"age": 25, "city": "New York", "name": "Alice"} |
-- +--------------------------------------------------+
SELECT h.data
FROM legacy_object_live o
INNER JOIN legacy_hash h
    ON o._key = h._key
    AND o.type = h.type
WHERE o._key = "key1"
LIMIT 1;
