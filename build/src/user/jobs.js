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
const winston_1 = __importDefault(require("winston"));
const cronJob = require('cron').CronJob;
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const jobs = {};
function default_1(User) {
    User.startJobs = function () {
        winston_1.default.verbose('[user/jobs] (Re-)starting jobs...');
        let { digestHour } = meta_1.default.config;
        // Fix digest hour if invalid
        if (isNaN(digestHour)) {
            digestHour = 17;
        }
        else if (digestHour > 23 || digestHour < 0) {
            digestHour = 0;
        }
        User.stopJobs();
        startDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
        startDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
        startDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');
        jobs['reset.clean'] = new cronJob('0 0 * * *', User.reset.clean, null, true);
        winston_1.default.verbose('[user/jobs] Starting job (reset.clean)');
        winston_1.default.verbose(`[user/jobs] jobs started`);
    };
    function startDigestJob(name, cronString, term) {
        jobs[name] = new cronJob(cronString, (() => __awaiter(this, void 0, void 0, function* () {
            winston_1.default.verbose(`[user/jobs] Digest job (${name}) started.`);
            try {
                if (name === 'digest.weekly') {
                    const counter = yield database_1.default.increment('biweeklydigestcounter');
                    if (counter % 2) {
                        yield User.digest.execute({ interval: 'biweek' });
                    }
                }
                yield User.digest.execute({ interval: term });
            }
            catch (err) {
                winston_1.default.error(err.stack);
            }
        })), null, true);
        winston_1.default.verbose(`[user/jobs] Starting job (${name})`);
    }
    User.stopJobs = function () {
        let terminated = 0;
        // Terminate any active cron jobs
        for (const jobId of Object.keys(jobs)) {
            winston_1.default.verbose(`[user/jobs] Terminating job (${jobId})`);
            jobs[jobId].stop();
            delete jobs[jobId];
            terminated += 1;
        }
        if (terminated > 0) {
            winston_1.default.verbose(`[user/jobs] ${terminated} jobs terminated`);
        }
    };
}
exports.default = default_1;
;
