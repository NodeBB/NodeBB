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
const util = require('util');
const user = require('.');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');
const sleep = util.promisify(setTimeout);
const Interstitials = {};
Interstitials.get = (req, userData) => __awaiter(void 0, void 0, void 0, function* () {
    return plugins.hooks.fire('filter:register.interstitial', {
        req,
        userData,
        interstitials: [],
    });
});
Interstitials.email = (data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data.userData) {
        throw new Error('[[error:invalid-data]]');
    }
    if (!data.userData.updateEmail) {
        return data;
    }
    const [isAdminOrGlobalMod, hasPassword] = yield Promise.all([
        user.isAdminOrGlobalMod(data.req.uid),
        user.hasPassword(data.userData.uid),
    ]);
    let email;
    if (data.userData.uid) {
        email = yield user.getUserField(data.userData.uid, 'email');
    }
    data.interstitials.push({
        template: 'partials/email_update',
        data: {
            email,
            requireEmailAddress: meta_1.default.config.requireEmailAddress,
            issuePasswordChallenge: !!data.userData.uid && hasPassword,
        },
        callback: (userData, formData) => __awaiter(void 0, void 0, void 0, function* () {
            // Validate and send email confirmation
            if (userData.uid) {
                const [isPasswordCorrect, canEdit, { email: current, 'email:confirmed': confirmed }, { allowed, error }] = yield Promise.all([
                    user.isPasswordCorrect(userData.uid, formData.password, data.req.ip),
                    privileges.users.canEdit(data.req.uid, userData.uid),
                    user.getUserFields(userData.uid, ['email', 'email:confirmed']),
                    plugins.hooks.fire('filter:user.saveEmail', {
                        uid: userData.uid,
                        email: formData.email,
                        registration: false,
                        allowed: true,
                        error: '[[error:invalid-email]]',
                    }),
                ]);
                if (!isAdminOrGlobalMod && !isPasswordCorrect) {
                    yield sleep(2000);
                }
                if (formData.email && formData.email.length) {
                    if (!allowed || !utils.isEmailValid(formData.email)) {
                        throw new Error(error);
                    }
                    // Handle errors when setting to same email (unconfirmed accts only)
                    if (formData.email === current) {
                        if (confirmed) {
                            throw new Error('[[error:email-nochange]]');
                        }
                        else if (yield user.email.canSendValidation(userData.uid, current)) {
                            throw new Error(`[[error:confirm-email-already-sent, ${meta_1.default.config.emailConfirmInterval}]]`);
                        }
                    }
                    // Admins editing will auto-confirm, unless editing their own email
                    if (isAdminOrGlobalMod && userData.uid !== data.req.uid) {
                        yield user.setUserField(userData.uid, 'email', formData.email);
                        yield user.email.confirmByUid(userData.uid);
                    }
                    else if (canEdit) {
                        if (hasPassword && !isPasswordCorrect) {
                            throw new Error('[[error:invalid-password]]');
                        }
                        yield user.email.sendValidationEmail(userData.uid, {
                            email: formData.email,
                            force: true,
                        }).catch((err) => {
                            winston_1.default.error(`[user.interstitials.email] Validation email failed to send\n[emailer.send] ${err.stack}`);
                        });
                        data.req.session.emailChanged = 1;
                    }
                    else {
                        // User attempting to edit another user's email -- not allowed
                        throw new Error('[[error:no-privileges]]');
                    }
                }
                else {
                    if (meta_1.default.config.requireEmailAddress) {
                        throw new Error('[[error:invalid-email]]');
                    }
                    if (current.length && (!hasPassword || (hasPassword && isPasswordCorrect) || isAdminOrGlobalMod)) {
                        // User explicitly clearing their email
                        yield user.email.remove(userData.uid, data.req.session.id);
                    }
                }
            }
            else {
                const { allowed, error } = yield plugins.hooks.fire('filter:user.saveEmail', {
                    uid: null,
                    email: formData.email,
                    registration: true,
                    allowed: true,
                    error: '[[error:invalid-email]]',
                });
                if (!allowed || (meta_1.default.config.requireEmailAddress && !(formData.email && formData.email.length))) {
                    throw new Error(error);
                }
                // New registrants have the confirm email sent from user.create()
                userData.email = formData.email;
            }
            delete userData.updateEmail;
        }),
    });
    return data;
});
Interstitials.gdpr = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.gdpr_enabled || (data.userData && data.userData.gdpr_consent)) {
            return data;
        }
        if (!data.userData) {
            throw new Error('[[error:invalid-data]]');
        }
        if (data.userData.uid) {
            const consented = yield database_1.default.getObjectField(`user:${data.userData.uid}`, 'gdpr_consent');
            if (parseInt(consented, 10)) {
                return data;
            }
        }
        data.interstitials.push({
            template: 'partials/gdpr_consent',
            data: {
                digestFrequency: meta_1.default.config.dailyDigestFreq,
                digestEnabled: meta_1.default.config.dailyDigestFreq !== 'off',
            },
            callback: function (userData, formData, next) {
                if (formData.gdpr_agree_data === 'on' && formData.gdpr_agree_email === 'on') {
                    userData.gdpr_consent = true;
                }
                next(userData.gdpr_consent ? null : new Error('[[register:gdpr_consent_denied]]'));
            },
        });
        return data;
    });
};
Interstitials.tou = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.userData) {
            throw new Error('[[error:invalid-data]]');
        }
        if (!meta_1.default.config.termsOfUse || data.userData.acceptTos) {
            // no ToS or ToS accepted, nothing to do
            return data;
        }
        if (data.userData.uid) {
            const accepted = yield database_1.default.getObjectField(`user:${data.userData.uid}`, 'acceptTos');
            if (parseInt(accepted, 10)) {
                return data;
            }
        }
        const termsOfUse = yield plugins.hooks.fire('filter:parse.post', {
            postData: {
                content: meta_1.default.config.termsOfUse || '',
            },
        });
        data.interstitials.push({
            template: 'partials/acceptTos',
            data: {
                termsOfUse: termsOfUse.postData.content,
            },
            callback: function (userData, formData, next) {
                if (formData['agree-terms'] === 'on') {
                    userData.acceptTos = true;
                }
                next(userData.acceptTos ? null : new Error('[[register:terms_of_use_error]]'));
            },
        });
        return data;
    });
};
