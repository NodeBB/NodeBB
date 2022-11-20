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
const user_1 = __importDefault(require("../user"));
const flags = require('../flags');
const flagsApi = {};
flagsApi.create = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const required = ['type', 'id', 'reason'];
    if (!required.every(prop => !!data[prop])) {
        throw new Error('[[error:invalid-data]]');
    }
    const { type, id, reason } = data;
    yield flags.validate({
        uid: caller.uid,
        type: type,
        id: id,
    });
    const flagObj = yield flags.create(type, id, caller.uid, reason);
    flags.notify(flagObj, caller.uid);
    return flagObj;
});
flagsApi.update = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const allowed = yield user_1.default.isPrivileged(caller.uid);
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    const { flagId } = data;
    delete data.flagId;
    yield flags.update(flagId, caller.uid, data);
    return yield flags.getHistory(flagId);
});
flagsApi.appendNote = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const allowed = yield user_1.default.isPrivileged(caller.uid);
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.datetime && data.flagId) {
        try {
            const note = yield flags.getNote(data.flagId, data.datetime);
            if (note.uid !== caller.uid) {
                throw new Error('[[error:no-privileges]]');
            }
        }
        catch (e) {
            // Okay if not does not exist in database
            if (e.message !== '[[error:invalid-data]]') {
                throw e;
            }
        }
    }
    yield flags.appendNote(data.flagId, caller.uid, data.note, data.datetime);
    const [notes, history] = yield Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]);
    return { notes: notes, history: history };
});
flagsApi.deleteNote = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const note = yield flags.getNote(data.flagId, data.datetime);
    if (note.uid !== caller.uid) {
        throw new Error('[[error:no-privileges]]');
    }
    yield flags.deleteNote(data.flagId, data.datetime);
    yield flags.appendHistory(data.flagId, caller.uid, {
        notes: '[[flags:note-deleted]]',
        datetime: Date.now(),
    });
    const [notes, history] = yield Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]);
    return { notes: notes, history: history };
});
exports.default = flagsApi;
