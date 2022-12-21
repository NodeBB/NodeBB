'use strict';

const nconf = require('nconf');
const db = require('../../database');

module.exports = {
	name: 'Optimize PostgreSQL sessions',
	timestamp: Date.UTC(2018, 9, 1),
	method: function (callback) {
		if (nconf.get('database') !== 'postgres' || nconf.get('redis')) {
			return callback();
		}

		db.pool.query(`
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "session" (
	"sid" CHAR(32) NOT NULL
		COLLATE "C"
		PRIMARY KEY,
	"sess" JSONB NOT NULL,
	"expire" TIMESTAMPTZ NOT NULL
) WITHOUT OIDS;

CREATE INDEX IF NOT EXISTS "session_expire_idx" ON "session"("expire");

ALTER TABLE "session"
	ALTER "sid" TYPE CHAR(32) COLLATE "C",
	ALTER "sid" SET STORAGE PLAIN,
	ALTER "sess" TYPE JSONB,
	ALTER "expire" TYPE TIMESTAMPTZ,
	CLUSTER ON "session_expire_idx";

CLUSTER "session";
ANALYZE "session";

COMMIT;`, (err) => {
			callback(err);
		});
	},
};
