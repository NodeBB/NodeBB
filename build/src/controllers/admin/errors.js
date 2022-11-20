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
const json2csvAsync = require('json2csv').parseAsync;
const meta_1 = __importDefault(require("../../meta"));
const analytics = require('../../analytics');
const utils = require('../../utils');
const errorsController = {};
errorsController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield utils.promiseParallel({
            'not-found': meta_1.default.errors.get(true),
            analytics: analytics.getErrorAnalytics(),
        });
        res.render('admin/advanced/errors', data);
    });
};
errorsController.export = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield meta_1.default.errors.get(false);
        const fields = data.length ? Object.keys(data[0]) : [];
        const opts = { fields };
        const csv = yield json2csvAsync(data, opts);
        res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="404.csv"').send(csv);
    });
};
