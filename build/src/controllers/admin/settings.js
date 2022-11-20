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
const validator = require('validator');
const meta_1 = __importDefault(require("../../meta"));
const emailer = require('../../emailer');
const notifications = require('../../notifications');
const groups = require('../../groups');
const languages = require('../../languages');
const navigationAdmin = require('../../navigation/admin');
const social = require('../../social');
const helpers_1 = __importDefault(require("../helpers"));
const translator = require('../../translator');
const settingsController = {};
settingsController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const term = req.params.term || 'general';
        res.render(`admin/settings/${term}`);
    });
};
settingsController.email = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const emails = yield emailer.getTemplates(meta_1.default.config);
    res.render('admin/settings/email', {
        emails: emails,
        sendable: emails.filter((e) => !e.path.includes('_plaintext') && !e.path.includes('partials')).map((tpl) => tpl.path),
        services: emailer.listServices(),
    });
});
settingsController.user = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const notificationTypes = yield notifications.getAllNotificationTypes();
    const notificationSettings = notificationTypes.map((type) => ({
        name: type,
        label: `[[notifications:${type}]]`,
    }));
    res.render('admin/settings/user', {
        notificationSettings: notificationSettings,
    });
});
settingsController.post = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const groupData = yield groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
    res.render('admin/settings/post', {
        groupsExemptFromPostQueue: groupData,
    });
});
settingsController.advanced = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const groupData = yield groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
    res.render('admin/settings/advanced', {
        groupsExemptFromMaintenanceMode: groupData,
    });
});
settingsController.languages = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const languageData = yield languages.list();
        languageData.forEach((language) => {
            language.selected = language.code === meta_1.default.config.defaultLang;
        });
        res.render('admin/settings/languages', {
            languages: languageData,
            autoDetectLang: meta_1.default.config.autoDetectLang,
        });
    });
};
settingsController.navigation = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const [admin, allGroups] = yield Promise.all([
            navigationAdmin.getAdmin(),
            groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
        ]);
        allGroups.sort((a, b) => b.system - a.system);
        admin.groups = allGroups.map((group) => ({ name: group.name, displayName: group.displayName }));
        admin.enabled.forEach((enabled, index) => {
            enabled.index = index;
            enabled.selected = index === 0;
            enabled.title = translator.escape(enabled.title);
            enabled.text = translator.escape(enabled.text);
            enabled.dropdownContent = translator.escape(validator.escape(String(enabled.dropdownContent || '')));
            enabled.groups = admin.groups.map((group) => ({
                displayName: group.displayName,
                selected: enabled.groups.includes(group.name),
            }));
        });
        admin.available.forEach((available) => {
            available.groups = admin.groups;
        });
        admin.navigation = admin.enabled.slice();
        res.render('admin/settings/navigation', admin);
    });
};
settingsController.homepage = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const routes = yield helpers_1.default.getHomePageRoutes(req.uid);
        res.render('admin/settings/homepage', { routes: routes });
    });
};
settingsController.social = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const posts = yield social.getPostSharing();
        res.render('admin/settings/social', {
            posts: posts,
        });
    });
};
