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
const categories = require('../categories');
const plugins = require('../plugins');
const slugify = require('../slugify');
const database_1 = require("../database");
const user_1 = __importDefault(require("../user"));
const batch = require('../batch');
const meta_1 = __importDefault(require("../meta"));
const cache = require('../cache');
function default_1(Groups) {
    Groups.update = function (groupName, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield database_1.primaryDB.default.exists(`group:${groupName}`);
            if (!exists) {
                throw new Error('[[error:no-group]]');
            }
            ({ values } = yield plugins.hooks.fire('filter:group.update', {
                groupName: groupName,
                values: values,
            }));
            // Cast some values as bool (if not boolean already)
            // 'true' and '1' = true, everything else false
            ['userTitleEnabled', 'private', 'hidden', 'disableJoinRequests', 'disableLeave'].forEach((prop) => {
                if (values.hasOwnProperty(prop) && typeof values[prop] !== 'boolean') {
                    values[prop] = values[prop] === 'true' || parseInt(values[prop], 10) === 1;
                }
            });
            const payload = {
                description: values.description || '',
                icon: values.icon || '',
                labelColor: values.labelColor || '#000000',
                textColor: values.textColor || '#ffffff',
            };
            if (values.hasOwnProperty('userTitle')) {
                payload.userTitle = values.userTitle || '';
            }
            if (values.hasOwnProperty('userTitleEnabled')) {
                payload.userTitleEnabled = values.userTitleEnabled ? '1' : '0';
            }
            if (values.hasOwnProperty('hidden')) {
                payload.hidden = values.hidden ? '1' : '0';
            }
            if (values.hasOwnProperty('private')) {
                payload.private = values.private ? '1' : '0';
            }
            if (values.hasOwnProperty('disableJoinRequests')) {
                payload.disableJoinRequests = values.disableJoinRequests ? '1' : '0';
            }
            if (values.hasOwnProperty('disableLeave')) {
                payload.disableLeave = values.disableLeave ? '1' : '0';
            }
            if (values.hasOwnProperty('name')) {
                yield checkNameChange(groupName, values.name);
            }
            if (values.hasOwnProperty('private')) {
                yield updatePrivacy(groupName, values.private);
            }
            if (values.hasOwnProperty('hidden')) {
                yield updateVisibility(groupName, values.hidden);
            }
            if (values.hasOwnProperty('memberPostCids')) {
                const validCids = yield categories.getCidsByPrivilege('categories:cid', groupName, 'topics:read');
                const cidsArray = values.memberPostCids.split(',').map((cid) => parseInt(cid.trim(), 10)).filter(Boolean);
                payload.memberPostCids = cidsArray.filter((cid) => validCids.includes(cid)).join(',') || '';
            }
            yield database_1.primaryDB.default.setObject(`group:${groupName}`, payload);
            yield Groups.renameGroup(groupName, values.name);
            plugins.hooks.fire('action:group.update', {
                name: groupName,
                values: values,
            });
        });
    };
    function updateVisibility(groupName, hidden) {
        return __awaiter(this, void 0, void 0, function* () {
            if (hidden) {
                yield database_1.primaryDB.default.sortedSetRemoveBulk([
                    ['groups:visible:createtime', groupName],
                    ['groups:visible:memberCount', groupName],
                    ['groups:visible:name', `${groupName.toLowerCase()}:${groupName}`],
                ]);
                return;
            }
            const groupData = yield database_1.primaryDB.default.getObjectFields(`group:${groupName}`, ['createtime', 'memberCount']);
            yield database_1.primaryDB.default.sortedSetAddBulk([
                ['groups:visible:createtime', groupData.createtime, groupName],
                ['groups:visible:memberCount', groupData.memberCount, groupName],
                ['groups:visible:name', 0, `${groupName.toLowerCase()}:${groupName}`],
            ]);
        });
    }
    Groups.hide = function (groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield showHide(groupName, 'hidden');
        });
    };
    Groups.show = function (groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield showHide(groupName, 'show');
        });
    };
    function showHide(groupName, hidden) {
        return __awaiter(this, void 0, void 0, function* () {
            hidden = hidden === 'hidden';
            yield Promise.all([
                database_1.primaryDB.default.setObjectField(`group:${groupName}`, 'hidden', hidden ? 1 : 0),
                updateVisibility(groupName, hidden),
            ]);
        });
    }
    function updatePrivacy(groupName, isPrivate) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupData = yield Groups.getGroupFields(groupName, ['private']);
            const currentlyPrivate = groupData.private === 1;
            if (!currentlyPrivate || currentlyPrivate === isPrivate) {
                return;
            }
            const pendingUids = yield database_1.primaryDB.default.getSetMembers(`group:${groupName}:pending`);
            if (!pendingUids.length) {
                return;
            }
            winston_1.default.verbose(`[groups.update] Group is now public, automatically adding ${pendingUids.length} new members, who were pending prior.`);
            for (const uid of pendingUids) {
                /* eslint-disable no-await-in-loop */
                yield Groups.join(groupName, uid);
            }
            yield database_1.primaryDB.default.delete(`group:${groupName}:pending`);
        });
    }
    function checkNameChange(currentName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Groups.isPrivilegeGroup(newName)) {
                throw new Error('[[error:invalid-group-name]]');
            }
            const currentSlug = slugify(currentName);
            const newSlug = slugify(newName);
            if (currentName === newName || currentSlug === newSlug) {
                return;
            }
            Groups.validateGroupName(newName);
            const [group, exists] = yield Promise.all([
                Groups.getGroupData(currentName),
                Groups.existsBySlug(newSlug),
            ]);
            if (exists) {
                throw new Error('[[error:group-already-exists]]');
            }
            if (!group) {
                throw new Error('[[error:no-group]]');
            }
            if (group.system) {
                throw new Error('[[error:not-allowed-to-rename-system-group]]');
            }
        });
    }
    Groups.renameGroup = function (oldName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (oldName === newName || !newName || String(newName).length === 0) {
                return;
            }
            const group = yield database_1.primaryDB.default.getObject(`group:${oldName}`);
            if (!group) {
                return;
            }
            const exists = yield Groups.exists(newName);
            if (exists) {
                throw new Error('[[error:group-already-exists]]');
            }
            yield updateMemberGroupTitles(oldName, newName);
            yield updateNavigationItems(oldName, newName);
            yield updateWidgets(oldName, newName);
            yield updateConfig(oldName, newName);
            yield database_1.primaryDB.default.setObject(`group:${oldName}`, { name: newName, slug: slugify(newName) });
            yield database_1.primaryDB.default.deleteObjectField('groupslug:groupname', group.slug);
            yield database_1.primaryDB.default.setObjectField('groupslug:groupname', slugify(newName), newName);
            const allGroups = yield database_1.primaryDB.default.getSortedSetRange('groups:createtime', 0, -1);
            const keys = allGroups.map(group => `group:${group}:members`);
            yield renameGroupsMember(keys, oldName, newName);
            cache.del(keys);
            yield database_1.primaryDB.default.rename(`group:${oldName}`, `group:${newName}`);
            yield database_1.primaryDB.default.rename(`group:${oldName}:members`, `group:${newName}:members`);
            yield database_1.primaryDB.default.rename(`group:${oldName}:owners`, `group:${newName}:owners`);
            yield database_1.primaryDB.default.rename(`group:${oldName}:pending`, `group:${newName}:pending`);
            yield database_1.primaryDB.default.rename(`group:${oldName}:invited`, `group:${newName}:invited`);
            yield database_1.primaryDB.default.rename(`group:${oldName}:member:pids`, `group:${newName}:member:pids`);
            yield renameGroupsMember(['groups:createtime', 'groups:visible:createtime', 'groups:visible:memberCount'], oldName, newName);
            yield renameGroupsMember(['groups:visible:name'], `${oldName.toLowerCase()}:${oldName}`, `${newName.toLowerCase()}:${newName}`);
            plugins.hooks.fire('action:group.rename', {
                old: oldName,
                new: newName,
            });
            Groups.cache.reset();
        });
    };
    function updateMemberGroupTitles(oldName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet(`group:${oldName}:members`, (uids) => __awaiter(this, void 0, void 0, function* () {
                let usersData = yield user_1.default.getUsersData(uids);
                usersData = usersData.filter(userData => userData && userData.groupTitleArray.includes(oldName));
                usersData.forEach((userData) => {
                    userData.newTitleArray = userData.groupTitleArray.map(oldTitle => (oldTitle === oldName ? newName : oldTitle));
                });
                yield Promise.all(usersData.map(u => user_1.default.setUserField(u.uid, 'groupTitle', JSON.stringify(u.newTitleArray))));
            }), {});
        });
    }
    function renameGroupsMember(keys, oldName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            const isMembers = yield database_1.primaryDB.default.isMemberOfSortedSets(keys, oldName);
            keys = keys.filter((key, index) => isMembers[index]);
            if (!keys.length) {
                return;
            }
            const scores = yield database_1.primaryDB.default.sortedSetsScore(keys, oldName);
            yield database_1.primaryDB.default.sortedSetsRemove(keys, oldName);
            yield database_1.primaryDB.default.sortedSetsAdd(keys, scores, newName);
        });
    }
    function updateNavigationItems(oldName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            const navigation = require('../navigation/admin');
            const navItems = yield navigation.get();
            navItems.forEach((navItem) => {
                if (navItem && Array.isArray(navItem.groups) && navItem.groups.includes(oldName)) {
                    navItem.groups.splice(navItem.groups.indexOf(oldName), 1, newName);
                }
            });
            navigation.unescapeFields(navItems);
            yield navigation.save(navItems);
        });
    }
    function updateWidgets(oldName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            const admin = require('../widgets/admin');
            const widgets = require('../widgets');
            const data = yield admin.get();
            data.areas.forEach((area) => {
                area.widgets = area.data;
                area.widgets.forEach((widget) => {
                    if (widget && widget.data && Array.isArray(widget.data.groups) && widget.data.groups.includes(oldName)) {
                        widget.data.groups.splice(widget.data.groups.indexOf(oldName), 1, newName);
                    }
                });
            });
            for (const area of data.areas) {
                if (area.data.length) {
                    yield widgets.setArea(area);
                }
            }
        });
    }
    function updateConfig(oldName, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config.groupsExemptFromPostQueue.includes(oldName)) {
                meta_1.default.config.groupsExemptFromPostQueue.splice(meta_1.default.config.groupsExemptFromPostQueue.indexOf(oldName), 1, newName);
                yield meta_1.default.configs.set('groupsExemptFromPostQueue', meta_1.default.config.groupsExemptFromPostQueue);
            }
            if (meta_1.default.config.groupsExemptFromMaintenanceMode.includes(oldName)) {
                meta_1.default.config.groupsExemptFromMaintenanceMode.splice(meta_1.default.config.groupsExemptFromMaintenanceMode.indexOf(oldName), 1, newName);
                yield meta_1.default.configs.set('groupsExemptFromMaintenanceMode', meta_1.default.config.groupsExemptFromMaintenanceMode);
            }
        });
    }
}
exports.default = default_1;
;
