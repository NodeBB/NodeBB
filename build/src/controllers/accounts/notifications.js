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
const user_1 = __importDefault(require("../../user"));
const helpers_1 = __importDefault(require("../helpers"));
const plugins = require('../../plugins');
const pagination = require('../../pagination');
const notificationsController = {};
notificationsController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const regularFilters = [
            { name: '[[notifications:all]]', filter: '' },
            { name: '[[global:topics]]', filter: 'new-topic' },
            { name: '[[notifications:replies]]', filter: 'new-reply' },
            { name: '[[notifications:chat]]', filter: 'new-chat' },
            { name: '[[notifications:group-chat]]', filter: 'new-group-chat' },
            { name: '[[notifications:follows]]', filter: 'follow' },
            { name: '[[notifications:upvote]]', filter: 'upvote' },
        ];
        const moderatorFilters = [
            { name: '[[notifications:new-flags]]', filter: 'new-post-flag' },
            { name: '[[notifications:my-flags]]', filter: 'my-flags' },
            { name: '[[notifications:bans]]', filter: 'ban' },
        ];
        const filter = req.query.filter || '';
        const page = Math.max(1, req.query.page || 1);
        const itemsPerPage = 20;
        const start = (page - 1) * itemsPerPage;
        const stop = start + itemsPerPage - 1;
        const [filters, isPrivileged] = yield Promise.all([
            plugins.hooks.fire('filter:notifications.addFilters', {
                regularFilters: regularFilters,
                moderatorFilters: moderatorFilters,
                uid: req.uid,
            }),
            user_1.default.isPrivileged(req.uid),
        ]);
        let allFilters = filters.regularFilters;
        if (isPrivileged) {
            allFilters = allFilters.concat([
                { separator: true },
            ]).concat(filters.moderatorFilters);
        }
        const selectedFilter = allFilters.find((filterData) => {
            filterData.selected = filterData.filter === filter;
            return filterData.selected;
        });
        if (!selectedFilter) {
            return next();
        }
        const nids = yield user_1.default.notifications.getAll(req.uid, selectedFilter.filter);
        let notifications = yield user_1.default.notifications.getNotifications(nids, req.uid);
        const pageCount = Math.max(1, Math.ceil(notifications.length / itemsPerPage));
        notifications = notifications.slice(start, stop + 1);
        res.render('notifications', {
            notifications: notifications,
            pagination: pagination.create(page, pageCount, req.query),
            filters: allFilters,
            regularFilters: regularFilters,
            moderatorFilters: moderatorFilters,
            selectedFilter: selectedFilter,
            title: '[[pages:notifications]]',
            breadcrumbs: helpers_1.default.buildBreadcrumbs([{ text: '[[pages:notifications]]' }]),
        });
    });
};
