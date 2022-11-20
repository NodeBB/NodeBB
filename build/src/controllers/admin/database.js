'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf = require("nconf");
const databaseController = {};
databaseController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = {};
        if (nconf.get('redis')) {
            const rdb = require('../../database/redis');
            results.redis = yield rdb.info(rdb.client);
        }
        if (nconf.get('mongo')) {
            const mdb = require('../../database/mongo');
            results.mongo = yield mdb.info(mdb.client);
        }
        if (nconf.get('postgres')) {
            const pdb = require('../../database/postgres');
            results.postgres = yield pdb.info(pdb.pool);
        }
        res.render('admin/advanced/database', results);
    });
};
