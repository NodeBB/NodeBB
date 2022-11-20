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
const validator = require('validator');
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const privileges = require('../privileges');
const helpers = require('./helpers').defualt;
const Controllers = {};
Controllers.ping = require('./ping');
Controllers.home = require('./home');
Controllers.topics = require('./topics');
Controllers.posts = require('./posts');
Controllers.categories = require('./categories');
Controllers.category = require('./category');
Controllers.unread = require('./unread');
Controllers.recent = require('./recent');
Controllers.popular = require('./popular');
Controllers.top = require('./top');
Controllers.tags = require('./tags');
Controllers.search = require('./search');
Controllers.user = require('./user');
Controllers.users = require('./users');
Controllers.groups = require('./groups');
Controllers.accounts = require('./accounts');
Controllers.authentication = require('./authentication');
Controllers.api = require('./api');
Controllers.admin = require('./admin');
Controllers.globalMods = require('./globalmods');
Controllers.mods = require('./mods');
Controllers.sitemap = require('./sitemap');
Controllers.osd = require('./osd');
Controllers['404'] = require('./404');
Controllers.errors = require('./errors');
Controllers.composer = require('./composer');
Controllers.write = require('./write');
Controllers.reset = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['password:disableEdit']) {
            return helpers.notAllowed(req, res);
        }
        res.locals.metaTags = Object.assign(Object.assign({}, res.locals.metaTags), { name: 'robots', content: 'noindex' });
        const renderReset = function (code, valid) {
            res.render('reset_code', {
                valid: valid,
                displayExpiryNotice: req.session.passwordExpired,
                code: code,
                minimumPasswordLength: meta_1.default.config.minimumPasswordLength,
                minimumPasswordStrength: meta_1.default.config.minimumPasswordStrength,
                breadcrumbs: helpers.buildBreadcrumbs([
                    {
                        text: '[[reset_password:reset_password]]',
                        url: '/reset',
                    },
                    {
                        text: '[[reset_password:update_password]]',
                    },
                ]),
                title: '[[pages:reset]]',
            });
            delete req.session.passwordExpired;
        };
        if (req.params.code) {
            req.session.reset_code = req.params.code;
        }
        if (req.session.reset_code) {
            // Validate and save to local variable before removing from session
            const valid = yield user_1.default.reset.validate(req.session.reset_code);
            renderReset(req.session.reset_code, valid);
            delete req.session.reset_code;
        }
        else {
            res.render('reset', {
                code: null,
                breadcrumbs: helpers.buildBreadcrumbs([{
                        text: '[[reset_password:reset_password]]',
                    }]),
                title: '[[pages:reset]]',
            });
        }
    });
};
Controllers.login = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = { loginFormEntry: [] };
        const loginStrategies = require('../routes/authentication').getLoginStrategies();
        const registrationType = meta_1.default.config.registrationType || 'normal';
        const allowLoginWith = (meta_1.default.config.allowLoginWith || 'username-email');
        let errorText;
        if (req.query.error === 'csrf-invalid') {
            errorText = '[[error:csrf-invalid]]';
        }
        else if (req.query.error) {
            errorText = validator.escape(String(req.query.error));
        }
        if (req.headers['x-return-to']) {
            req.session.returnTo = req.headers['x-return-to'];
        }
        // Occasionally, x-return-to is passed a full url.
        req.session.returnTo = req.session.returnTo && req.session.returnTo.replace(nconf_1.default.get('base_url'), '').replace(nconf_1.default.get('relative_path'), '');
        data.alternate_logins = loginStrategies.length > 0;
        data.authentication = loginStrategies;
        data.allowRegistration = registrationType === 'normal';
        data.allowLoginWith = `[[login:${allowLoginWith}]]`;
        data.breadcrumbs = helpers.buildBreadcrumbs([{
                text: '[[global:login]]',
            }]);
        data.error = req.flash('error')[0] || errorText;
        data.title = '[[pages:login]]';
        data.allowPasswordReset = !meta_1.default.config['password:disableEdit'];
        const hasLoginPrivilege = yield privileges.global.canGroup('local:login', 'registered-users');
        data.allowLocalLogin = hasLoginPrivilege || parseInt(req.query.local, 10) === 1;
        if (!data.allowLocalLogin && !data.allowRegistration && data.alternate_logins && data.authentication.length === 1) {
            return helpers.redirect(res, { external: data.authentication[0].url });
        }
        // Re-auth challenge, pre-fill username
        if (req.loggedIn) {
            const userData = yield user_1.default.getUserFields(req.uid, ['username']);
            data.username = userData.username;
            data.alternate_logins = false;
        }
        res.render('login', data);
    });
};
Controllers.register = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const registrationType = meta_1.default.config.registrationType || 'normal';
        if (registrationType === 'disabled') {
            return setImmediate(next);
        }
        let errorText;
        const returnTo = (req.headers['x-return-to'] || '').replace(nconf_1.default.get('base_url') + nconf_1.default.get('relative_path'), '');
        if (req.query.error === 'csrf-invalid') {
            errorText = '[[error:csrf-invalid]]';
        }
        try {
            if (registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
                try {
                    yield user_1.default.verifyInvitation(req.query);
                }
                catch (e) {
                    return res.render('400', {
                        error: e.message,
                    });
                }
            }
            if (returnTo) {
                req.session.returnTo = returnTo;
            }
            const loginStrategies = require('../routes/authentication').getLoginStrategies();
            res.render('register', {
                'register_window:spansize': loginStrategies.length ? 'col-md-6' : 'col-md-12',
                alternate_logins: !!loginStrategies.length,
                authentication: loginStrategies,
                minimumUsernameLength: meta_1.default.config.minimumUsernameLength,
                maximumUsernameLength: meta_1.default.config.maximumUsernameLength,
                minimumPasswordLength: meta_1.default.config.minimumPasswordLength,
                minimumPasswordStrength: meta_1.default.config.minimumPasswordStrength,
                breadcrumbs: helpers.buildBreadcrumbs([{
                        text: '[[register:register]]',
                    }]),
                regFormEntry: [],
                error: req.flash('error')[0] || errorText,
                title: '[[pages:register]]',
            });
        }
        catch (err) {
            next(err);
        }
    });
};
Controllers.registerInterstitial = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.session.hasOwnProperty('registration')) {
            return res.redirect(`${nconf_1.default.get('relative_path')}/register`);
        }
        try {
            const data = yield user_1.default.interstitials.get(req, req.session.registration);
            if (!data.interstitials.length) {
                // No interstitials, redirect to home
                const returnTo = req.session.returnTo || req.session.registration.returnTo;
                delete req.session.registration;
                return helpers.redirect(res, returnTo || '/');
            }
            const errors = req.flash('errors');
            const renders = data.interstitials.map((interstitial) => req.app.renderAsync(interstitial.template, Object.assign(Object.assign({}, interstitial.data || {}), { errors })));
            const sections = yield Promise.all(renders);
            res.render('registerComplete', {
                title: '[[pages:registration-complete]]',
                register: data.userData.register,
                sections,
                errors,
            });
        }
        catch (err) {
            next(err);
        }
    });
};
Controllers.confirmEmail = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield user_1.default.email.confirmByCode(req.params.code, req.session.id);
    }
    catch (e) {
        if (e.message === '[[error:invalid-data]]') {
            return next();
        }
        throw e;
    }
    res.render('confirm', {
        title: '[[pages:confirm]]',
    });
});
Controllers.robots = function (req, res) {
    res.set('Content-Type', 'text/plain');
    if (meta_1.default.config['robots:txt']) {
        res.send(meta_1.default.config['robots:txt']);
    }
    else {
        res.send(`${'User-agent: *\n' +
            'Disallow: '}${nconf_1.default.get('relative_path')}/admin/\n` +
            `Disallow: ${nconf_1.default.get('relative_path')}/reset/\n` +
            `Disallow: ${nconf_1.default.get('relative_path')}/compose\n` +
            `Sitemap: ${nconf_1.default.get('url')}/sitemap.xml`);
    }
};
Controllers.manifest = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const manifest = {
            name: meta_1.default.config.title || 'NodeBB',
            short_name: meta_1.default.config['title:short'] || meta_1.default.config.title || 'NodeBB',
            start_url: nconf_1.default.get('url'),
            display: 'standalone',
            orientation: 'portrait',
            theme_color: meta_1.default.config.themeColor || '#ffffff',
            background_color: meta_1.default.config.backgroundColor || '#ffffff',
            icons: [],
        };
        if (meta_1.default.config['brand:touchIcon']) {
            manifest.icons.push({
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-36.png`,
                sizes: '36x36',
                type: 'image/png',
                density: 0.75,
            }, {
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-48.png`,
                sizes: '48x48',
                type: 'image/png',
                density: 1.0,
            }, {
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-72.png`,
                sizes: '72x72',
                type: 'image/png',
                density: 1.5,
            }, {
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-96.png`,
                sizes: '96x96',
                type: 'image/png',
                density: 2.0,
            }, {
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-144.png`,
                sizes: '144x144',
                type: 'image/png',
                density: 3.0,
            }, {
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-192.png`,
                sizes: '192x192',
                type: 'image/png',
                density: 4.0,
            }, {
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-512.png`,
                sizes: '512x512',
                type: 'image/png',
                density: 10.0,
            });
        }
        if (meta_1.default.config['brand:maskableIcon']) {
            manifest.icons.push({
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/maskableicon-orig.png`,
                type: 'image/png',
                purpose: 'maskable',
            });
        }
        else if (meta_1.default.config['brand:touchIcon']) {
            manifest.icons.push({
                src: `${nconf_1.default.get('relative_path')}/assets/uploads/system/touchicon-orig.png`,
                type: 'image/png',
                purpose: 'maskable',
            });
        }
        const data = yield plugins.hooks.fire('filter:manifest.build', {
            req: req,
            res: res,
            manifest: manifest,
        });
        res.status(200).json(data.manifest);
    });
};
Controllers.outgoing = function (req, res, next) {
    const url = req.query.url || '';
    const allowedProtocols = [
        'http', 'https', 'ftp', 'ftps', 'mailto', 'news', 'irc', 'gopher',
        'nntp', 'feed', 'telnet', 'mms', 'rtsp', 'svn', 'tel', 'fax', 'xmpp', 'webcal',
    ];
    const parsed = require('url').parse(url);
    if (!url || !parsed.protocol || !allowedProtocols.includes(parsed.protocol.slice(0, -1))) {
        return next();
    }
    res.render('outgoing', {
        outgoing: validator.escape(String(url)),
        title: meta_1.default.config.title,
        breadcrumbs: helpers.buildBreadcrumbs([{
                text: '[[notifications:outgoing_link]]',
            }]),
    });
};
Controllers.termsOfUse = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.termsOfUse) {
            return next();
        }
        const termsOfUse = yield plugins.hooks.fire('filter:parse.post', {
            postData: {
                content: meta_1.default.config.termsOfUse || '',
            },
        });
        res.render('tos', {
            termsOfUse: termsOfUse.postData.content,
        });
    });
};
