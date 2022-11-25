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
const rss = require('rss');
const nconf_1 = __importDefault(require("nconf"));
const validator = require('validator');
const posts = require('../posts');
const topics = require('../topics');
const user_1 = __importDefault(require("../user"));
const categories = require('../categories');
const meta_1 = __importDefault(require("../meta"));
const helpers = require('../controllers/helpers');
const privileges = require('../privileges');
const database = __importStar(require("../database"));
const db = database;
const utils = require('../utils');
const controllers404 = require('../controllers/404');
const terms = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    alltime: 'alltime',
};
function default_1(app, middleware) {
    app.get('/topic/:topic_id.rss', middleware.maintenanceMode, generateForTopic);
    app.get('/category/:category_id.rss', middleware.maintenanceMode, generateForCategory);
    app.get('/topics.rss', middleware.maintenanceMode, generateForTopics);
    app.get('/recent.rss', middleware.maintenanceMode, generateForRecent);
    app.get('/top.rss', middleware.maintenanceMode, generateForTop);
    app.get('/top/:term.rss', middleware.maintenanceMode, generateForTop);
    app.get('/popular.rss', middleware.maintenanceMode, generateForPopular);
    app.get('/popular/:term.rss', middleware.maintenanceMode, generateForPopular);
    app.get('/recentposts.rss', middleware.maintenanceMode, generateForRecentPosts);
    app.get('/category/:category_id/recentposts.rss', middleware.maintenanceMode, generateForCategoryRecentPosts);
    app.get('/user/:userslug/topics.rss', middleware.maintenanceMode, generateForUserTopics);
    app.get('/tags/:tag.rss', middleware.maintenanceMode, generateForTag);
}
exports.default = default_1;
;
function validateTokenIfRequiresLogin(requiresLogin, cid, req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = parseInt(req.query.uid, 10) || 0;
        const { token } = req.query;
        if (!requiresLogin) {
            return true;
        }
        if (uid <= 0 || !token) {
            return helpers.notAllowed(req, res);
        }
        const userToken = yield db.getObjectField(`user:${uid}`, 'rss_token');
        if (userToken !== token) {
            yield user_1.default.auth.logAttempt(uid, req.ip);
            return helpers.notAllowed(req, res);
        }
        const userPrivileges = yield privileges.categories.get(cid, uid);
        if (!userPrivileges.read) {
            return helpers.notAllowed(req, res);
        }
        return true;
    });
}
function generateForTopic(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return next();
        }
        const tid = req.params.topic_id;
        const [userPrivileges, topic] = yield Promise.all([
            privileges.topics.get(tid, req.uid),
            topics.getTopicData(tid),
        ]);
        if (!privileges.topics.canViewDeletedScheduled(topic, userPrivileges)) {
            return next();
        }
        if (yield validateTokenIfRequiresLogin(!userPrivileges['topics:read'], topic.cid, req, res)) {
            const topicData = yield topics.getTopicWithPosts(topic, `tid:${tid}:posts`, req.uid || req.query.uid || 0, 0, 24, true);
            topics.modifyPostsByPrivilege(topicData, userPrivileges);
            const feed = new rss({
                title: utils.stripHTMLTags(topicData.title, utils.tags),
                description: topicData.posts.length ? topicData.posts[0].content : '',
                feed_url: `${nconf_1.default.get('url')}/topic/${tid}.rss`,
                site_url: `${nconf_1.default.get('url')}/topic/${topicData.slug}`,
                image_url: topicData.posts.length ? topicData.posts[0].picture : '',
                author: topicData.posts.length ? topicData.posts[0].username : '',
                ttl: 60,
            });
            if (topicData.posts.length > 0) {
                feed.pubDate = new Date(parseInt(topicData.posts[0].timestamp, 10)).toUTCString();
            }
            const replies = topicData.posts.slice(1);
            replies.forEach((postData) => {
                if (!postData.deleted) {
                    const dateStamp = new Date(parseInt(parseInt(postData.edited, 10) === 0 ? postData.timestamp : postData.edited, 10)).toUTCString();
                    feed.item({
                        title: `Reply to ${utils.stripHTMLTags(topicData.title, utils.tags)} on ${dateStamp}`,
                        description: postData.content,
                        url: `${nconf_1.default.get('url')}/post/${postData.pid}`,
                        author: postData.user ? postData.user.username : '',
                        date: dateStamp,
                    });
                }
            });
            sendFeed(feed, res);
        }
    });
}
function generateForCategory(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = req.params.category_id;
        if (meta_1.default.config['feeds:disableRSS'] || !parseInt(cid, 10)) {
            return next();
        }
        const uid = req.uid || req.query.uid || 0;
        const [userPrivileges, category, tids] = yield Promise.all([
            privileges.categories.get(cid, req.uid),
            categories.getCategoryData(cid),
            db.getSortedSetRevIntersect({
                sets: ['topics:tid', `cid:${cid}:tids:lastposttime`],
                start: 0,
                stop: 25,
                weights: [1, 0],
            }),
        ]);
        if (!category || !category.name) {
            return next();
        }
        if (yield validateTokenIfRequiresLogin(!userPrivileges.read, cid, req, res)) {
            let topicsData = yield topics.getTopicsByTids(tids, uid);
            topicsData = yield user_1.default.blocks.filter(uid, topicsData);
            const feed = yield generateTopicsFeed({
                uid: uid,
                title: category.name,
                description: category.description,
                feed_url: `/category/${cid}.rss`,
                site_url: `/category/${category.cid}`,
            }, topicsData, 'timestamp');
            sendFeed(feed, res);
        }
    });
}
function generateForTopics(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return next();
        }
        let token = null;
        if (req.query.token && req.query.uid) {
            token = yield db.getObjectField(`user:${req.query.uid}`, 'rss_token');
        }
        yield sendTopicsFeed({
            uid: token && token === req.query.token ? req.query.uid : req.uid,
            title: 'Most recently created topics',
            description: 'A list of topics that have been created recently',
            feed_url: '/topics.rss',
            useMainPost: true,
        }, 'topics:tid', res);
    });
}
function generateForRecent(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield generateSorted({
            title: 'Recently Active Topics',
            description: 'A list of topics that have been active within the past 24 hours',
            feed_url: '/recent.rss',
            site_url: '/recent',
            sort: 'recent',
            timestampField: 'lastposttime',
            term: 'alltime',
        }, req, res, next);
    });
}
function generateForTop(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield generateSorted({
            title: 'Top Voted Topics',
            description: 'A list of topics that have received the most votes',
            feed_url: `/top/${req.params.term || 'daily'}.rss`,
            site_url: `/top/${req.params.term || 'daily'}`,
            sort: 'votes',
            timestampField: 'timestamp',
            term: 'day',
        }, req, res, next);
    });
}
function generateForPopular(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield generateSorted({
            title: 'Popular Topics',
            description: 'A list of topics that are sorted by post count',
            feed_url: `/popular/${req.params.term || 'daily'}.rss`,
            site_url: `/popular/${req.params.term || 'daily'}`,
            sort: 'posts',
            timestampField: 'timestamp',
            term: 'day',
        }, req, res, next);
    });
}
function generateSorted(options, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return next();
        }
        const term = terms[req.params.term] || options.term;
        let token = null;
        if (req.query.token && req.query.uid) {
            token = yield db.getObjectField(`user:${req.query.uid}`, 'rss_token');
        }
        const uid = token && token === req.query.token ? req.query.uid : req.uid;
        const params = {
            uid: uid,
            start: 0,
            stop: 19,
            term: term,
            sort: options.sort,
        };
        const { cid } = req.query;
        if (cid) {
            if (!(yield privileges.categories.can('topics:read', cid, uid))) {
                return helpers.notAllowed(req, res);
            }
            params.cids = [cid];
        }
        const result = yield topics.getSortedTopics(params);
        const feed = yield generateTopicsFeed({
            uid: uid,
            title: options.title,
            description: options.description,
            feed_url: options.feed_url,
            site_url: options.site_url,
        }, result.topics, options.timestampField);
        sendFeed(feed, res);
    });
}
function sendTopicsFeed(options, set, res, timestampField) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = options.hasOwnProperty('start') ? options.start : 0;
        const stop = options.hasOwnProperty('stop') ? options.stop : 19;
        const topicData = yield topics.getTopicsFromSet(set, options.uid, start, stop);
        const feed = yield generateTopicsFeed(options, topicData.topics, timestampField);
        sendFeed(feed, res);
    });
}
function generateTopicsFeed(feedOptions, feedTopics, timestampField) {
    return __awaiter(this, void 0, void 0, function* () {
        feedOptions.ttl = 60;
        feedOptions.feed_url = nconf_1.default.get('url') + feedOptions.feed_url;
        feedOptions.site_url = nconf_1.default.get('url') + feedOptions.site_url;
        feedTopics = feedTopics.filter(Boolean);
        const feed = new rss(feedOptions);
        if (feedTopics.length > 0) {
            feed.pubDate = new Date(feedTopics[0][timestampField]).toUTCString();
        }
        function addFeedItem(topicData) {
            return __awaiter(this, void 0, void 0, function* () {
                const feedItem = {
                    title: utils.stripHTMLTags(topicData.title, utils.tags),
                    url: `${nconf_1.default.get('url')}/topic/${topicData.slug}`,
                    date: new Date(topicData[timestampField]).toUTCString(),
                };
                if (topicData.deleted) {
                    return;
                }
                if (topicData.teaser && topicData.teaser.user && !feedOptions.useMainPost) {
                    feedItem.description = topicData.teaser.content;
                    feedItem.author = topicData.teaser.user.username;
                    feed.item(feedItem);
                    return;
                }
                const mainPost = yield topics.getMainPost(topicData.tid, feedOptions.uid);
                if (!mainPost) {
                    feed.item(feedItem);
                    return;
                }
                feedItem.description = mainPost.content;
                feedItem.author = mainPost.user && mainPost.user.username;
                feed.item(feedItem);
            });
        }
        for (const topicData of feedTopics) {
            /* eslint-disable no-await-in-loop */
            yield addFeedItem(topicData);
        }
        return feed;
    });
}
function generateForRecentPosts(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return next();
        }
        const page = parseInt(req.query.page, 10) || 1;
        const postsPerPage = 20;
        const start = Math.max(0, (page - 1) * postsPerPage);
        const stop = start + postsPerPage - 1;
        const postData = yield posts.getRecentPosts(req.uid, start, stop, 'month');
        const feed = generateForPostsFeed({
            title: 'Recent Posts',
            description: 'A list of recent posts',
            feed_url: '/recentposts.rss',
            site_url: '/recentposts',
        }, postData);
        sendFeed(feed, res);
    });
}
function generateForCategoryRecentPosts(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return controllers404.handle404(req, res);
        }
        const cid = req.params.category_id;
        const page = parseInt(req.query.page, 10) || 1;
        const topicsPerPage = 20;
        const start = Math.max(0, (page - 1) * topicsPerPage);
        const stop = start + topicsPerPage - 1;
        const [userPrivileges, category, postData] = yield Promise.all([
            privileges.categories.get(cid, req.uid),
            categories.getCategoryData(cid),
            categories.getRecentReplies(cid, req.uid || req.query.uid || 0, start, stop),
        ]);
        if (!category) {
            return controllers404.handle404(req, res);
        }
        if (yield validateTokenIfRequiresLogin(!userPrivileges.read, cid, req, res)) {
            const feed = generateForPostsFeed({
                title: `${category.name} Recent Posts`,
                description: `A list of recent posts from ${category.name}`,
                feed_url: `/category/${cid}/recentposts.rss`,
                site_url: `/category/${cid}/recentposts`,
            }, postData);
            sendFeed(feed, res);
        }
    });
}
function generateForPostsFeed(feedOptions, posts) {
    feedOptions.ttl = 60;
    feedOptions.feed_url = nconf_1.default.get('url') + feedOptions.feed_url;
    feedOptions.site_url = nconf_1.default.get('url') + feedOptions.site_url;
    const feed = new rss(feedOptions);
    if (posts.length > 0) {
        feed.pubDate = new Date(parseInt(posts[0].timestamp, 10)).toUTCString();
    }
    posts.forEach((postData) => {
        feed.item({
            title: postData.topic ? postData.topic.title : '',
            description: postData.content,
            url: `${nconf_1.default.get('url')}/post/${postData.pid}`,
            author: postData.user ? postData.user.username : '',
            date: new Date(parseInt(postData.timestamp, 10)).toUTCString(),
        });
    });
    return feed;
}
function generateForUserTopics(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return next();
        }
        const { userslug } = req.params;
        const uid = yield user_1.default.getUidByUserslug(userslug);
        if (!uid) {
            return next();
        }
        const userData = yield user_1.default.getUserFields(uid, ['uid', 'username']);
        yield sendTopicsFeed({
            uid: req.uid,
            title: `Topics by ${userData.username}`,
            description: `A list of topics that are posted by ${userData.username}`,
            feed_url: `/user/${userslug}/topics.rss`,
            site_url: `/user/${userslug}/topics`,
        }, `uid:${userData.uid}:topics`, res);
    });
}
function generateForTag(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['feeds:disableRSS']) {
            return controllers404.handle404(req, res);
        }
        const tag = validator.escape(String(req.params.tag));
        const page = parseInt(req.query.page, 10) || 1;
        const topicsPerPage = meta_1.default.config.topicsPerPage || 20;
        const start = Math.max(0, (page - 1) * topicsPerPage);
        const stop = start + topicsPerPage - 1;
        yield sendTopicsFeed({
            uid: req.uid,
            title: `Topics tagged with ${tag}`,
            description: `A list of topics that have been tagged with ${tag}`,
            feed_url: `/tags/${tag}.rss`,
            site_url: `/tags/${tag}`,
            start: start,
            stop: stop,
        }, `tag:${tag}:topics`, res);
    });
}
function sendFeed(feed, res) {
    const xml = feed.xml();
    res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
}
