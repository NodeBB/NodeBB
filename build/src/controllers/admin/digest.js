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
const meta_1 = __importDefault(require("../../meta"));
const digest = require('../../user/digest');
const pagination = require('../../pagination');
const digestController = {};
digestController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const resultsPerPage = 50;
        const start = Math.max(0, page - 1) * resultsPerPage;
        const stop = start + resultsPerPage - 1;
        const delivery = yield digest.getDeliveryTimes(start, stop);
        const pageCount = Math.ceil(delivery.count / resultsPerPage);
        res.render('admin/manage/digest', {
            title: '[[admin/menu:manage/digest]]',
            delivery: delivery.users,
            default: meta_1.default.config.dailyDigestFreq,
            pagination: pagination.create(page, pageCount),
        });
    });
};
