'use strict';

const user = require('.');
const db = require('../database');
const meta = require('../meta');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');

const Interstitials = module.exports;

Interstitials.email = async (data) => {
	if (!data.userData) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!data.userData.updateEmail) {
		return data;
	}

	let email;
	if (data.userData.uid) {
		email = await user.getUserField(data.userData.uid, 'email');
	}

	data.interstitials.push({
		template: 'partials/email_update',
		data: { email },
		callback: async (userData, formData) => {
			// Validate and send email confirmation
			if (userData.uid) {
				const [isAdminOrGlobalMod, canEdit, current] = await Promise.all([
					user.isAdminOrGlobalMod(data.req.uid),
					privileges.users.canEdit(data.req.uid, userData.uid),
					user.getUserField(userData.uid, 'email'),
				]);

				if (formData.email && formData.email.length) {
					if (!utils.isEmailValid(formData.email)) {
						throw new Error('[[error:invalid-email]]');
					}

					if (formData.email === current) {
						throw new Error('[[error:email-nochange]]');
					}

					// Admins editing will auto-confirm, unless editing their own email
					if (isAdminOrGlobalMod && userData.uid !== data.req.uid) {
						await user.setUserField(userData.uid, 'email', formData.email);
						await user.email.confirmByUid(userData.uid);
					} else if (canEdit) {
						await user.email.sendValidationEmail(userData.uid, {
							email: formData.email,
							force: true,
						});
						data.req.session.emailChanged = 1;
					} else {
						// User attempting to edit another user's email -- not allowed
						throw new Error('[[error:no-privileges]]');
					}
				} else if (current) {
					// User explicitly clearing their email
					await user.email.remove(userData.uid, data.req.session.id);
				}
			} else {
				// New registrants have the confirm email sent from user.create()
				userData.email = formData.email;
			}

			delete userData.updateEmail;
		},
	});

	return data;
};

Interstitials.gdpr = async function (data) {
	if (!meta.config.gdpr_enabled || (data.userData && data.userData.gdpr_consent)) {
		return data;
	}
	if (!data.userData) {
		throw new Error('[[error:invalid-data]]');
	}

	if (data.userData.uid) {
		const consented = await db.getObjectField(`user:${data.userData.uid}`, 'gdpr_consent');
		if (parseInt(consented, 10)) {
			return data;
		}
	}

	data.interstitials.push({
		template: 'partials/gdpr_consent',
		data: {
			digestFrequency: meta.config.dailyDigestFreq,
			digestEnabled: meta.config.dailyDigestFreq !== 'off',
		},
		callback: function (userData, formData, next) {
			if (formData.gdpr_agree_data === 'on' && formData.gdpr_agree_email === 'on') {
				userData.gdpr_consent = true;
			}

			next(userData.gdpr_consent ? null : new Error('[[register:gdpr_consent_denied]]'));
		},
	});
	return data;
};

Interstitials.tou = async function (data) {
	if (!data.userData) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!meta.config.termsOfUse || data.userData.acceptTos) {
		// no ToS or ToS accepted, nothing to do
		return data;
	}

	if (data.userData.uid) {
		const accepted = await db.getObjectField(`user:${data.userData.uid}`, 'acceptTos');
		if (parseInt(accepted, 10)) {
			return data;
		}
	}

	const termsOfUse = await plugins.hooks.fire('filter:parse.post', {
		postData: {
			content: meta.config.termsOfUse || '',
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
};
