'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Optimize PostgreSQL sessions',
    timestamp: Date.UTC(2018, 9, 1),
    method: function (callback) {
        if (nconf_1.default.get('database') !== 'postgres' || nconf_1.default.get('redis')) {
            return callback();
        }
        database_1.default.pool.query(`
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
