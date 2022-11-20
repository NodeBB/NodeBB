'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const request = require('request');
const winston_1 = __importDefault(require("winston"));
const crypto = require('crypto');
const cronJob = require('cron').CronJob;
const pkg = require('../../../package.json');
const meta_1 = __importDefault(require("../meta"));
function default_1(Plugins) {
    Plugins.startJobs = function () {
        new cronJob('0 0 0 * * *', (() => {
            Plugins.submitUsageData();
        }), null, true);
    };
    Plugins.submitUsageData = function (callback) {
        callback = callback || function () { };
        if (!meta_1.default.config.submitPluginUsage || !Plugins.loadedPlugins.length || global.env !== 'production') {
            return callback();
        }
        const hash = crypto.createHash('sha256');
        hash.update(nconf_1.default.get('url'));
        request.post(`${nconf_1.default.get('registry') || 'https://packages.nodebb.org'}/api/v1/plugin/usage`, {
            form: {
                id: hash.digest('hex'),
                version: pkg.version,
                plugins: Plugins.loadedPlugins,
            },
            timeout: 5000,
        }, (err, res, body) => {
            if (err) {
                winston_1.default.error(err.stack);
                return callback(err);
            }
            if (res.statusCode !== 200) {
                winston_1.default.error(`[plugins.submitUsageData] received ${res.statusCode} ${body}`);
                callback(new Error(`[[error:nbbpm-${res.statusCode}]]`));
            }
            else {
                callback();
            }
        });
    };
}
exports.default = default_1;
;
