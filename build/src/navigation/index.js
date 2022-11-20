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
const nconf_1 = __importDefault(require("nconf"));
const validator = require('validator');
const admin = require('./admin');
const groups = require('../groups');
const navigation = {};
const relative_path = nconf_1.default.get('relative_path');
navigation.get = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let data = yield admin.get();
        data = data.filter((item) => item && item.enabled).map((item) => {
            item.originalRoute = validator.unescape(item.route);
            if (!item.route.startsWith('http')) {
                item.route = relative_path + item.route;
            }
            return item;
        });
        const pass = yield Promise.all(data.map((navItem) => __awaiter(this, void 0, void 0, function* () {
            if (!navItem.groups.length) {
                return true;
            }
            return yield groups.isMemberOfAny(uid, navItem.groups);
        })));
        return data.filter((navItem, i) => pass[i]);
    });
};
require('../promisify').promisify(navigation);
