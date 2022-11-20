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
const topics = require('../../topics');
const Tags = {};
Tags.create = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        yield topics.createEmptyTag(data.tag);
    });
};
Tags.rename = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(data)) {
            throw new Error('[[error:invalid-data]]');
        }
        yield topics.renameTags(data);
    });
};
Tags.deleteTags = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        yield topics.deleteTags(data.tags);
    });
};
