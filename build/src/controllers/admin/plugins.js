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
const winston_1 = __importDefault(require("winston"));
const plugins = require('../../plugins');
const meta_1 = __importDefault(require("../../meta"));
const pluginsController = {};
pluginsController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const [compatible, all, trending] = yield Promise.all([
            getCompatiblePlugins(),
            getAllPlugins(),
            plugins.listTrending(),
        ]);
        const compatiblePkgNames = compatible.map((pkgData) => pkgData.name);
        const installedPlugins = compatible.filter((plugin) => plugin && plugin.installed);
        const activePlugins = all.filter((plugin) => plugin && plugin.installed && plugin.active);
        const trendingScores = trending.reduce((memo, cur) => {
            memo[cur.label] = cur.value;
            return memo;
        }, {});
        const trendingPlugins = all
            .filter((plugin) => plugin && Object.keys(trendingScores).includes(plugin.id))
            .sort((a, b) => trendingScores[b.id] - trendingScores[a.id])
            .map((plugin) => {
            plugin.downloads = trendingScores[plugin.id];
            return plugin;
        });
        res.render('admin/extend/plugins', {
            installed: installedPlugins,
            installedCount: installedPlugins.length,
            activeCount: activePlugins.length,
            inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
            canChangeState: !nconf_1.default.get('plugins:active'),
            upgradeCount: compatible.reduce((count, current) => {
                if (current.installed && current.outdated) {
                    count += 1;
                }
                return count;
            }, 0),
            download: compatible.filter((plugin) => !plugin.installed),
            incompatible: all.filter((plugin) => !compatiblePkgNames.includes(plugin.name)),
            trending: trendingPlugins,
            submitPluginUsage: meta_1.default.config.submitPluginUsage,
            version: nconf_1.default.get('version'),
        });
    });
};
function getCompatiblePlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getPlugins(true);
    });
}
function getAllPlugins() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getPlugins(false);
    });
}
function getPlugins(matching) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const pluginsData = yield plugins.list(matching);
            return pluginsData || [];
        }
        catch (err) {
            winston_1.default.error(err.stack);
            return [];
        }
    });
}
exports.default = pluginsController;
