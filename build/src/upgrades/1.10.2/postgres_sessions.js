'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Optimize PostgreSQL sessions',
    timestamp: Date.UTC(2018, 9, 1),
    method: function (callback) {
        if (nconf_1.default.get('database') !== 'postgres' || nconf_1.default.get('redis')) {
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
