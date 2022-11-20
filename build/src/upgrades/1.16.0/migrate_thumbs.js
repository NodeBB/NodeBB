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
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
const topics = require('../../topics');
const batch = require('../../batch');
exports.default = {
    name: 'Migrate existing topic thumbnails to new format',
    timestamp: Date.UTC(2020, 11, 11),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const current = yield meta_1.default.configs.get('topicThumbSize');
            if (parseInt(current, 10) === 120) {
                yield meta_1.default.configs.set('topicThumbSize', 512);
            }
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                const keys = tids.map(tid => `topic:${tid}`);
                const topicThumbs = (yield database_1.default.getObjectsFields(keys, ['thumb']))
                    .map(obj => (obj.thumb ? obj.thumb.replace(nconf_1.default.get('upload_url'), '') : null));
                yield Promise.all(tids.map((tid, idx) => __awaiter(this, void 0, void 0, function* () {
                    const path = topicThumbs[idx];
                    if (path) {
                        if (path.length < 255 && !path.startsWith('data:')) {
                            yield topics.thumbs.associate({ id: tid, path });
                        }
                        yield database_1.default.deleteObjectField(keys[idx], 'thumb');
                    }
                    progress.incr();
                })));
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
