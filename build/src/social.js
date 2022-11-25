'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const _ = require('lodash');
const plugins = require('./plugins');
const database = __importStar(require("./database"));
const db = database;
const social = {};
social.postSharing = null;
social.getPostSharing = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (social.postSharing) {
            return _.cloneDeep(social.postSharing);
        }
        let networks = [
            {
                id: 'facebook',
                name: 'Facebook',
                class: 'fa-facebook',
            },
            {
                id: 'twitter',
                name: 'Twitter',
                class: 'fa-twitter',
            },
        ];
        networks = yield plugins.hooks.fire('filter:social.posts', networks);
        // @ts-ignore
        const activated = yield db.getSetMembers('social:posts.activated');
        networks.forEach((network) => {
            network.activated = activated.includes(network.id);
        });
        social.postSharing = networks;
        return _.cloneDeep(networks);
    });
};
social.getActivePostSharing = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const networks = yield social.getPostSharing();
        return networks.filter(network => network && network.activated);
    });
};
social.setActivePostSharingNetworks = function (networkIDs) {
    return __awaiter(this, void 0, void 0, function* () {
        social.postSharing = null;
        // @ts-ignore
        yield db.delete('social:posts.activated');
        if (!networkIDs.length) {
            return;
        }
        // @ts-ignore
        yield db.setAdd('social:posts.activated', networkIDs);
    });
};
require('./promisify').promisify(social);
exports.default = social;
