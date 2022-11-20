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
const nconf = require("nconf");
const validator = require('validator');
const helpers = require('./helpers').defualt;
const recentController = require('./recent');
const popularController = {};
popularController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield recentController.getData(req, 'popular', 'posts');
        if (!data) {
            return next();
        }
        const term = helpers.terms[req.query.term] || 'alltime';
        if (req.originalUrl.startsWith(`${nconf.get('relative_path')}/api/popular`) || req.originalUrl.startsWith(`${nconf.get('relative_path')}/popular`)) {
            data.title = `[[pages:popular-${term}]]`;
            const breadcrumbs = [{ text: '[[global:header.popular]]' }];
            data.breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
        }
        const feedQs = data.rssFeedUrl.split('?')[1];
        data.rssFeedUrl = `${nconf.get('relative_path')}/popular/${validator.escape(String(req.query.term || 'alltime'))}.rss`;
        if (req.loggedIn) {
            data.rssFeedUrl += `?${feedQs}`;
        }
        res.render('popular', data);
    });
};
