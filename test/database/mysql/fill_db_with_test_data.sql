 -- Insert into legacy_object
INSERT INTO legacy_object (_key, type, expireAt) VALUES
('key1', 'hash', NULL),
('key2', 'hash', NULL),
('key3', 'hash', NULL),
('key4', 'hash', NULL),
('key5', 'hash', NULL);

-- Insert into legacy_hash with matching _key values and random JSON data
INSERT INTO legacy_hash (_key, type, data) VALUES
('key1', 'hash', '{"name": "Alice", "age": 25, "city": "New York"}'),
('key2', 'hash', '{"product": "Laptop", "price": 999, "inStock": true}'),
('key3', 'hash', '{"id": 123, "score": 85.5, "active": false}'),
('key4', 'hash', '{"title": "Book", "pages": 300, "author": "John Doe"}'),
('key5', 'hash', '{"event": "Concert", "date": "2025-05-01", "tickets": 50}');