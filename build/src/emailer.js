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
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const Benchpress = require('benchpressjs');
const nodemailer = require('nodemailer');
const wellKnownServices = require('nodemailer/lib/well-known/services');
const { htmlToText } = require('html-to-text');
const url = require('url');
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const User = require('./user');
const Plugins = require('./plugins');
const meta = require('./meta');
const translator = require('./translator');
const pubsub = require('./pubsub');
const file = require('./file');
const viewsDir = nconf_1.default.get('views_dir');
const Emailer = {};
let prevConfig;
let app;
Emailer.fallbackNotFound = false;
Emailer.transports = {
    sendmail: nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
    }),
    smtp: undefined,
};
Emailer.listServices = () => Object.keys(wellKnownServices);
Emailer._defaultPayload = {};
const smtpSettingsChanged = (config) => {
    const settings = [
        'email:smtpTransport:enabled',
        'email:smtpTransport:pool',
        'email:smtpTransport:user',
        'email:smtpTransport:pass',
        'email:smtpTransport:service',
        'email:smtpTransport:port',
        'email:smtpTransport:host',
        'email:smtpTransport:security',
    ];
    // config only has these properties if settings are saved on /admin/settings/email
    return settings.some(key => config.hasOwnProperty(key) && config[key] !== prevConfig[key]);
};
const getHostname = () => {
    const configUrl = nconf_1.default.get('url');
    const parsed = url.parse(configUrl);
    return parsed.hostname;
};
const buildCustomTemplates = (config) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // If the new config contains any email override values, re-compile those templates
        const toBuild = Object
            .keys(config)
            .filter(prop => prop.startsWith('email:custom:'))
            .map(key => key.split(':')[2]);
        if (!toBuild.length) {
            return;
        }
        const [templates, allPaths] = yield Promise.all([
            Emailer.getTemplates(config),
            file.walk(viewsDir),
        ]);
        const templatesToBuild = templates.filter(template => toBuild.includes(template.path));
        const paths = _.fromPairs(allPaths.map((p) => {
            const relative = path_1.default.relative(viewsDir, p).replace(/\\/g, '/');
            return [relative, p];
        }));
        yield Promise.all(templatesToBuild.map((template) => __awaiter(void 0, void 0, void 0, function* () {
            const source = yield meta.templates.processImports(paths, template.path, template.text);
            const compiled = yield Benchpress.precompile(source, { filename: template.path });
            yield fs.promises.writeFile(template.fullpath.replace(/\.tpl$/, '.js'), compiled);
        })));
        Benchpress.flush();
        winston_1.default.verbose('[emailer] Built custom email templates');
    }
    catch (err) {
        winston_1.default.error(`[emailer] Failed to build custom email templates\n${err.stack}`);
    }
});
Emailer.getTemplates = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const emailsPath = path_1.default.join(viewsDir, 'emails');
    let emails = yield file.walk(emailsPath);
    emails = emails.filter(email => !email.endsWith('.js'));
    const templates = yield Promise.all(emails.map((email) => __awaiter(void 0, void 0, void 0, function* () {
        const path = email.replace(emailsPath, '').slice(1).replace('.tpl', '');
        const original = yield fs.promises.readFile(email, 'utf8');
        return {
            path: path,
            fullpath: email,
            text: config[`email:custom:${path}`] || original,
            original: original,
            isCustom: !!config[`email:custom:${path}`],
        };
    })));
    return templates;
});
Emailer.setupFallbackTransport = (config) => {
    winston_1.default.verbose('[emailer] Setting up fallback transport');
    // Enable SMTP transport if enabled in ACP
    if (parseInt(config['email:smtpTransport:enabled'], 10) === 1) {
        const smtpOptions = {
            name: getHostname(),
            pool: config['email:smtpTransport:pool'],
        };
        if (config['email:smtpTransport:user'] || config['email:smtpTransport:pass']) {
            smtpOptions.auth = {
                user: config['email:smtpTransport:user'],
                pass: config['email:smtpTransport:pass'],
            };
        }
        if (config['email:smtpTransport:service'] === 'nodebb-custom-smtp') {
            smtpOptions.port = config['email:smtpTransport:port'];
            smtpOptions.host = config['email:smtpTransport:host'];
            if (config['email:smtpTransport:security'] === 'NONE') {
                smtpOptions.secure = false;
                smtpOptions.requireTLS = false;
                smtpOptions.ignoreTLS = true;
            }
            else if (config['email:smtpTransport:security'] === 'STARTTLS') {
                smtpOptions.secure = false;
                smtpOptions.requireTLS = true;
                smtpOptions.ignoreTLS = false;
            }
            else {
                // meta.config['email:smtpTransport:security'] === 'ENCRYPTED' or undefined
                smtpOptions.secure = true;
                smtpOptions.requireTLS = true;
                smtpOptions.ignoreTLS = false;
            }
        }
        else {
            smtpOptions.service = String(config['email:smtpTransport:service']);
        }
        Emailer.transports.smtp = nodemailer.createTransport(smtpOptions);
        Emailer.fallbackTransport = Emailer.transports.smtp;
    }
    else {
        Emailer.fallbackTransport = Emailer.transports.sendmail;
    }
};
Emailer.registerApp = (expressApp) => {
    app = expressApp;
    let logo = null;
    if (meta.config.hasOwnProperty('brand:emailLogo')) {
        logo = (!meta.config['brand:emailLogo'].startsWith('http') ? nconf_1.default.get('url') : '') + meta.config['brand:emailLogo'];
    }
    Emailer._defaultPayload = {
        url: nconf_1.default.get('url'),
        site_title: meta.config.title || 'NodeBB',
        logo: {
            src: logo,
            height: meta.config['brand:emailLogo:height'],
            width: meta.config['brand:emailLogo:width'],
        },
    };
    Emailer.setupFallbackTransport(meta.config);
    buildCustomTemplates(meta.config);
    // need to shallow clone the config object
    // otherwise prevConfig holds reference to meta.config object,
    // which is updated before the pubsub handler is called
    prevConfig = Object.assign({}, meta.config);
    pubsub.on('config:update', (config) => {
        // config object only contains properties for the specific acp settings page
        // not the entire meta.config object
        if (config) {
            // Update default payload if new logo is uploaded
            if (config.hasOwnProperty('brand:emailLogo')) {
                Emailer._defaultPayload.logo.src = config['brand:emailLogo'];
            }
            if (config.hasOwnProperty('brand:emailLogo:height')) {
                Emailer._defaultPayload.logo.height = config['brand:emailLogo:height'];
            }
            if (config.hasOwnProperty('brand:emailLogo:width')) {
                Emailer._defaultPayload.logo.width = config['brand:emailLogo:width'];
            }
            if (smtpSettingsChanged(config)) {
                Emailer.setupFallbackTransport(config);
            }
            buildCustomTemplates(config);
            prevConfig = Object.assign(Object.assign({}, prevConfig), config);
        }
    });
    return Emailer;
};
Emailer.send = (template, uid, params) => __awaiter(void 0, void 0, void 0, function* () {
    if (!app) {
        throw Error('[emailer] App not ready!');
    }
    let userData = yield User.getUserFields(uid, ['email', 'username', 'email:confirmed', 'banned']);
    // 'welcome' and 'verify-email' explicitly used passed-in email address
    if (['welcome', 'verify-email'].includes(template)) {
        userData.email = params.email;
    }
    ({ template, userData, params } = yield Plugins.hooks.fire('filter:email.prepare', { template, uid, userData, params }));
    if (!meta.config.sendEmailToBanned && template !== 'banned') {
        if (userData.banned) {
            winston_1.default.warn(`[emailer/send] User ${userData.username} (uid: ${uid}) is banned; not sending email due to system config.`);
            return;
        }
    }
    if (!userData || !userData.email) {
        if (process.env.NODE_ENV === 'development') {
            winston_1.default.warn(`uid : ${uid} has no email, not sending "${template}" email.`);
        }
        return;
    }
    const allowedTpls = ['verify-email', 'welcome', 'registration_accepted', 'reset', 'reset_notify'];
    if (!meta.config.includeUnverifiedEmails && !userData['email:confirmed'] && !allowedTpls.includes(template)) {
        if (process.env.NODE_ENV === 'development') {
            winston_1.default.warn(`uid : ${uid} (${userData.email}) has not confirmed email, not sending "${template}" email.`);
        }
        return;
    }
    const userSettings = yield User.getSettings(uid);
    // Combined passed-in payload with default values
    params = Object.assign(Object.assign({}, Emailer._defaultPayload), params);
    params.uid = uid;
    params.username = userData.username;
    params.rtl = (yield translator.translate('[[language:dir]]', userSettings.userLang)) === 'rtl';
    const result = yield Plugins.hooks.fire('filter:email.cancel', {
        cancel: false,
        template: template,
        params: params,
    });
    if (result.cancel) {
        return;
    }
    yield Emailer.sendToEmail(template, userData.email, userSettings.userLang, params);
});
Emailer.sendToEmail = (template, email, language, params) => __awaiter(void 0, void 0, void 0, function* () {
    const lang = language || meta.config.defaultLang || 'en-GB';
    const unsubscribable = ['digest', 'notification'];
    // Digests and notifications can be one-click unsubbed
    let payload = {
        template: template,
        uid: params.uid,
    };
    if (unsubscribable.includes(template)) {
        if (template === 'notification') {
            payload.type = params.notification.type;
        }
        payload = jwt.sign(payload, nconf_1.default.get('secret'), {
            expiresIn: '30d',
        });
        const unsubUrl = [nconf_1.default.get('url'), 'email', 'unsubscribe', payload].join('/');
        params.headers = Object.assign({ 'List-Id': `<${[template, params.uid, getHostname()].join('.')}>`, 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }, params.headers);
        params.unsubUrl = unsubUrl;
    }
    const result = yield Plugins.hooks.fire('filter:email.params', {
        template: template,
        email: email,
        language: lang,
        params: params,
    });
    template = result.template;
    email = result.email;
    params = result.params;
    const [html, subject] = yield Promise.all([
        Emailer.renderAndTranslate(template, params, result.language),
        translator.translate(params.subject, result.language),
    ]);
    const data = yield Plugins.hooks.fire('filter:email.modify', {
        _raw: params,
        to: email,
        from: meta.config['email:from'] || `no-reply@${getHostname()}`,
        from_name: meta.config['email:from_name'] || 'NodeBB',
        subject: `[${meta.config.title}] ${_.unescape(subject)}`,
        html: html,
        plaintext: htmlToText(html, {
            tags: { img: { format: 'skip' } },
        }),
        template: template,
        uid: params.uid,
        pid: params.pid,
        fromUid: params.fromUid,
        headers: params.headers,
        rtl: params.rtl,
    });
    const usingFallback = !Plugins.hooks.hasListeners('filter:email.send') &&
        !Plugins.hooks.hasListeners('static:email.send');
    try {
        if (Plugins.hooks.hasListeners('filter:email.send')) {
            // Deprecated, remove in v1.19.0
            yield Plugins.hooks.fire('filter:email.send', data);
        }
        else if (Plugins.hooks.hasListeners('static:email.send')) {
            yield Plugins.hooks.fire('static:email.send', data);
        }
        else {
            yield Emailer.sendViaFallback(data);
        }
    }
    catch (err) {
        if (err.code === 'ENOENT' && usingFallback) {
            Emailer.fallbackNotFound = true;
            throw new Error('[[error:sendmail-not-found]]');
        }
        else {
            throw err;
        }
    }
});
Emailer.sendViaFallback = (data) => __awaiter(void 0, void 0, void 0, function* () {
    // Some minor alterations to the data to conform to nodemailer standard
    data.text = data.plaintext;
    delete data.plaintext;
    // NodeMailer uses a combined "from"
    data.from = `${data.from_name}<${data.from}>`;
    delete data.from_name;
    yield Emailer.fallbackTransport.sendMail(data);
});
Emailer.renderAndTranslate = (template, params, lang) => __awaiter(void 0, void 0, void 0, function* () {
    const html = yield app.renderAsync(`emails/${template}`, params);
    return yield translator.translate(html, lang);
});
require('./promisify').promisify(Emailer, ['transports']);
