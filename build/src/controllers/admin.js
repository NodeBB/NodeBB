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
Object.defineProperty(exports, "__esModule", { value: true });
const privileges = require('../privileges');
const helpers = require('./helpers').defualt;
const adminController = {
    dashboard: require('./admin/dashboard'),
    categories: require('./admin/categories'),
    privileges: require('./admin/privileges'),
    adminsMods: require('./admin/admins-mods'),
    tags: require('./admin/tags'),
    groups: require('./admin/groups'),
    digest: require('./admin/digest'),
    appearance: require('./admin/appearance'),
    extend: {
        widgets: require('./admin/widgets'),
        rewards: require('./admin/rewards'),
    },
    events: require('./admin/events'),
    hooks: require('./admin/hooks'),
    logs: require('./admin/logs'),
    errors: require('./admin/errors'),
    database: require('./admin/database'),
    cache: require('./admin/cache'),
    plugins: require('./admin/plugins'),
    settings: require('./admin/settings'),
    logger: require('./admin/logger'),
    themes: require('./admin/themes'),
    users: require('./admin/users'),
    uploads: require('./admin/uploads'),
    info: require('./admin/info'),
};
adminController.routeIndex = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const privilegeSet = yield privileges.admin.get(req.uid);
    if (privilegeSet.superadmin || privilegeSet['admin:dashboard']) {
        return adminController.dashboard.get(req, res);
    }
    else if (privilegeSet['admin:categories']) {
        return helpers.redirect(res, 'admin/manage/categories');
    }
    else if (privilegeSet['admin:privileges']) {
        return helpers.redirect(res, 'admin/manage/privileges');
    }
    else if (privilegeSet['admin:users']) {
        return helpers.redirect(res, 'admin/manage/users');
    }
    else if (privilegeSet['admin:groups']) {
        return helpers.redirect(res, 'admin/manage/groups');
    }
    else if (privilegeSet['admin:admins-mods']) {
        return helpers.redirect(res, 'admin/manage/admins-mods');
    }
    else if (privilegeSet['admin:tags']) {
        return helpers.redirect(res, 'admin/manage/tags');
    }
    else if (privilegeSet['admin:settings']) {
        return helpers.redirect(res, 'admin/settings/general');
    }
    return helpers.notAllowed(req, res);
});
exports.default = adminController;
