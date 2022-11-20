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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const file = require('../../file');
const { paths } = require('../../constants');
const themesController = {};
const defaultScreenshotPath = path_1.default.join(__dirname, '../../../../public/images/themes/default.png');
themesController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const themeDir = path_1.default.join(paths.nodeModules, req.params.theme);
        const themeConfigPath = path_1.default.join(themeDir, 'theme.json');
        let themeConfig;
        try {
            themeConfig = yield fs.promises.readFile(themeConfigPath, 'utf8');
            themeConfig = JSON.parse(themeConfig);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return next(Error('invalid-data'));
            }
            return next(err);
        }
        const screenshotPath = themeConfig.screenshot ? path_1.default.join(themeDir, themeConfig.screenshot) : defaultScreenshotPath;
        const exists = yield file.exists(screenshotPath);
        res.sendFile(exists ? screenshotPath : defaultScreenshotPath);
    });
};
