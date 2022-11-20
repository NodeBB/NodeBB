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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const nconf_1 = __importDefault(require("nconf"));
const fs = require('fs').promises;
const path_1 = __importDefault(require("path"));
function default_1(app) {
    const router = express.Router();
    router.get('/test', (req, res) => __awaiter(this, void 0, void 0, function* () {
        res.redirect(404);
    }));
    // Redoc
    router.get('/spec/:type', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const types = ['read', 'write'];
        const { type } = req.params;
        if (!types.includes(type)) {
            return next();
        }
        const handle = yield fs.open(path_1.default.resolve(__dirname, '../../../public/vendor/redoc/index.html'), 'r');
        let html = yield handle.readFile({
            encoding: 'utf-8',
        });
        yield handle.close();
        html = html.replace('apiUrl', `${nconf_1.default.get('relative_path')}/assets/openapi/${type}.yaml`);
        res.status(200).type('text/html').send(html);
    }));
    app.use(`${nconf_1.default.get('relative_path')}/debug`, router);
}
exports.default = default_1;
;
