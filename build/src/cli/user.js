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
const { Command, Option } = require('commander');
const meta_1 = __importDefault(require("../meta"));
const nconf_1 = __importDefault(require("nconf"));
exports.default = () => {
    const userCmd = new Command('user')
        .description('Manage users')
        .arguments('[command]');
    userCmd.configureHelp(require('./colors'));
    const userCommands = UserCommands();
    userCmd
        .command('info')
        .description('Display user info by uid/username/userslug.')
        .option('-i, --uid <uid>', 'Retrieve user by uid')
        .option('-u, --username <username>', 'Retrieve user by username')
        .option('-s, --userslug <userslug>', 'Retrieve user by userslug')
        .action((...args) => execute(userCommands.info, args));
    userCmd
        .command('create')
        .description('Create a new user.')
        .arguments('<username>')
        .option('-p, --password <password>', 'Set a new password. (Auto-generates if omitted)')
        .option('-e, --email <email>', 'Associate with an email.')
        .action((...args) => execute(userCommands.create, args));
    userCmd
        .command('reset')
        .description('Reset a user\'s password or send a password reset email.')
        .arguments('<uid>')
        .option('-p, --password <password>', 'Set a new password. (Auto-generates if passed empty)', false)
        .option('-s, --send-reset-email', 'Send a password reset email.', false)
        .action((...args) => execute(userCommands.reset, args));
    userCmd
        .command('delete')
        .description('Delete user(s) and/or their content')
        .arguments('<uids...>')
        .addOption(new Option('-t, --type [operation]', 'Delete user content ([purge]), leave content ([account]), or delete content only ([content])')
        .choices(['purge', 'account', 'content']).default('purge'))
        .action((...args) => execute(userCommands.deleteUser, args));
    const make = userCmd.command('make')
        .description('Make user(s) admin, global mod, moderator or a regular user.')
        .arguments('[command]');
    make.command('admin')
        .description('Make user(s) an admin')
        .arguments('<uids...>')
        .action((...args) => execute(userCommands.makeAdmin, args));
    make.command('global-mod')
        .description('Make user(s) a global moderator')
        .arguments('<uids...>')
        .action((...args) => execute(userCommands.makeGlobalMod, args));
    make.command('mod')
        .description('Make uid(s) of user(s) moderator of given category IDs (cids)')
        .arguments('<uids...>')
        .requiredOption('-c, --cid <cids...>', 'ID(s) of categories to make the user a moderator of')
        .action((...args) => execute(userCommands.makeMod, args));
    make.command('regular')
        .description('Make user(s) a non-privileged user')
        .arguments('<uids...>')
        .action((...args) => execute(userCommands.makeRegular, args));
    return userCmd;
};
let db;
let user;
let groups;
let privileges;
let privHelpers;
let utils;
let winston;
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        db = require('../database').default.default;
        yield db.init();
        user = require('../user');
        groups = require('../groups');
        privileges = require('../privileges');
        privHelpers = require('../privileges/helpers');
        utils = require('../utils');
        winston = require('winston');
    });
}
function execute(cmd, args) {
    return __awaiter(this, void 0, void 0, function* () {
        yield init();
        try {
            yield cmd(...args);
        }
        catch (err) {
            const userError = err.name === 'UserError';
            winston.error(`[userCmd/${cmd.name}] ${userError ? `${err.message}` : 'Command failed.'}`, userError ? '' : err);
            process.exit(1);
        }
        process.exit();
    });
}
function UserCmdHelpers() {
    function getAdminUidOrFail() {
        return __awaiter(this, void 0, void 0, function* () {
            const adminUid = yield user.getFirstAdminUid();
            if (!adminUid) {
                const err = new Error('An admin account does not exists to execute the operation.');
                err.name = 'UserError';
                throw err;
            }
            return adminUid;
        });
    }
    function setupApp() {
        return __awaiter(this, void 0, void 0, function* () {
            const Benchpress = require('benchpressjs');
            yield meta_1.default.configs.init();
            const webserver = require('../webserver');
            const viewsDir = nconf_1.default.get('views_dir');
            webserver.app.engine('tpl', (filepath, data, next) => {
                filepath = filepath.replace(/\.tpl$/, '.js');
                Benchpress.__express(filepath, data, next);
            });
            webserver.app.set('view engine', 'tpl');
            webserver.app.set('views', viewsDir);
            const emailer = require('../emailer');
            emailer.registerApp(webserver.app);
        });
    }
    const argParsers = {
        intParse: (value, varName) => {
            const parsedValue = parseInt(value, 10);
            if (isNaN(parsedValue)) {
                const err = new Error(`"${varName}" expected to be a number.`);
                err.name = 'UserError';
                throw err;
            }
            return parsedValue;
        },
        intArrayParse: (values, varName) => values.map(value => argParsers.intParse(value, varName)),
    };
    return {
        argParsers,
        getAdminUidOrFail,
        setupApp,
    };
}
function UserCommands() {
    const { argParsers, getAdminUidOrFail, setupApp } = UserCmdHelpers();
    function info({ uid, username, userslug }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!uid && !username && !userslug) {
                return winston.error('[userCmd/info] At least one option has to be passed (--uid, --username or --userslug).');
            }
            if (uid) {
                uid = argParsers.intParse(uid, 'uid');
            }
            else if (username) {
                uid = yield user.getUidByUsername(username);
            }
            else {
                uid = yield user.getUidByUserslug(userslug);
            }
            const userData = yield user.getUserData(uid);
            winston.info('[userCmd/info] User info retrieved:');
            console.log(userData);
        });
    }
    function create(username, { password, email }) {
        return __awaiter(this, void 0, void 0, function* () {
            let pwGenerated = false;
            if (password === undefined) {
                password = utils.generateUUID().slice(0, 8);
                pwGenerated = true;
            }
            const userExists = yield user.getUidByUsername(username);
            if (userExists) {
                return winston.error(`[userCmd/create] A user with username '${username}' already exists`);
            }
            const uid = yield user.create({
                username,
                password,
                email,
            });
            winston.info(`[userCmd/create] User '${username}'${password ? '' : ' without a password'} has been created with uid: ${uid}.\
${pwGenerated ? ` Generated password: ${password}` : ''}`);
        });
    }
    function reset(uid, { password, sendResetEmail }) {
        return __awaiter(this, void 0, void 0, function* () {
            uid = argParsers.intParse(uid, 'uid');
            if (password === false && sendResetEmail === false) {
                return winston.error('[userCmd/reset] At least one option has to be passed (--password or --send-reset-email).');
            }
            const userExists = yield user.exists(uid);
            if (!userExists) {
                return winston.error(`[userCmd/reset] A user with given uid does not exists.`);
            }
            let pwGenerated = false;
            if (password === '') {
                password = utils.generateUUID().slice(0, 8);
                pwGenerated = true;
            }
            const adminUid = yield getAdminUidOrFail();
            if (password) {
                yield user.setUserField(uid, 'password', '');
                yield user.changePassword(adminUid, {
                    newPassword: password,
                    uid,
                });
                winston.info(`[userCmd/reset] ${password ? 'User password changed.' : ''}${pwGenerated ? ` Generated password: ${password}` : ''}`);
            }
            if (sendResetEmail) {
                const userEmail = yield user.getUserField(uid, 'email');
                if (!userEmail) {
                    return winston.error('User doesn\'t have an email address to send reset email.');
                }
                yield setupApp();
                yield user.reset.send(userEmail);
                winston.info('[userCmd/reset] Password reset email has been sent.');
            }
        });
    }
    function deleteUser(uids, { type }) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = argParsers.intArrayParse(uids, 'uids');
            const userExists = yield user.exists(uids);
            if (!userExists || userExists.some((r) => r === false)) {
                return winston.error(`[userCmd/reset] A user with given uid does not exists.`);
            }
            yield db.initSessionStore();
            const adminUid = yield getAdminUidOrFail();
            switch (type) {
                case 'purge':
                    yield Promise.all(uids.map(uid => user.delete(adminUid, uid)));
                    winston.info(`[userCmd/delete] User(s) with their content has been deleted.`);
                    break;
                case 'account':
                    yield Promise.all(uids.map(uid => user.deleteAccount(uid)));
                    winston.info(`[userCmd/delete] User(s) has been deleted, their content left intact.`);
                    break;
                case 'content':
                    yield Promise.all(uids.map(uid => user.deleteContent(adminUid, uid)));
                    winston.info(`[userCmd/delete] User(s)' content has been deleted.`);
                    break;
            }
        });
    }
    function makeAdmin(uids) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = argParsers.intArrayParse(uids, 'uids');
            yield Promise.all(uids.map(uid => groups.join('administrators', uid)));
            winston.info('[userCmd/make/admin] User(s) added as administrators.');
        });
    }
    function makeGlobalMod(uids) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = argParsers.intArrayParse(uids, 'uids');
            yield Promise.all(uids.map(uid => groups.join('Global Moderators', uid)));
            winston.info('[userCmd/make/globalMod] User(s) added as global moderators.');
        });
    }
    function makeMod(uids, { cid: cids }) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = argParsers.intArrayParse(uids, 'uids');
            cids = argParsers.intArrayParse(cids, 'cids');
            const categoryPrivList = yield privileges.categories.getPrivilegeList();
            yield privHelpers.giveOrRescind(groups.join, categoryPrivList, cids, uids);
            winston.info('[userCmd/make/mod] User(s) added as moderators to given categories.');
        });
    }
    function makeRegular(uids) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = argParsers.intArrayParse(uids, 'uids');
            yield Promise.all(uids.map(uid => groups.leave(['administrators', 'Global Moderators'], uid)));
            const categoryPrivList = yield privileges.categories.getPrivilegeList();
            const cids = yield db.getSortedSetRevRange('categories:cid', 0, -1);
            yield privHelpers.giveOrRescind(groups.leave, categoryPrivList, cids, uids);
            winston.info('[userCmd/make/regular] User(s) made regular/non-privileged.');
        });
    }
    return {
        info,
        create,
        reset,
        deleteUser,
        makeAdmin,
        makeGlobalMod,
        makeMod,
        makeRegular,
    };
}
