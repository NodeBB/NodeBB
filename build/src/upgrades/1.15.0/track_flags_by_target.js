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
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'New sorted set for tracking flags by target',
    timestamp: Date.UTC(2020, 6, 15),
    method: () => __awaiter(void 0, void 0, void 0, function* () {
        const flags = yield database_1.default.getSortedSetRange('flags:hash', 0, -1);
        yield Promise.all(flags.map((flag) => __awaiter(void 0, void 0, void 0, function* () {
            flag = flag.split(':').slice(0, 2);
            yield database_1.default.sortedSetIncrBy('flags:byTarget', 1, flag.join(':'));
        })));
    }),
};
