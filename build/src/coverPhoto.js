'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const meta = require('./meta');
const relative_path = nconf_1.default.get('relative_path');
const coverPhoto = {};
coverPhoto.getDefaultGroupCover = function (groupName) {
    return getCover('groups', groupName);
};
coverPhoto.getDefaultProfileCover = function (uid) {
    return getCover('profile', parseInt(uid, 10));
};
function getCover(type, id) {
    const defaultCover = `${relative_path}/assets/images/cover-default.png`;
    if (meta.config[`${type}:defaultCovers`]) {
        const covers = String(meta.config[`${type}:defaultCovers`]).trim().split(/[\s,]+/g);
        let coverPhoto = defaultCover;
        if (!covers.length) {
            return coverPhoto;
        }
        if (typeof id === 'string') {
            id = (id.charCodeAt(0) + id.charCodeAt(1)) % covers.length;
        }
        else {
            id %= covers.length;
        }
        if (covers[id]) {
            coverPhoto = covers[id].startsWith('http') ? covers[id] : (relative_path + covers[id]);
        }
        return coverPhoto;
    }
    return defaultCover;
}
