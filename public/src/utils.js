
'use strict';

const $ = require('jquery');

const utils = { ...require('./utils.common') };

utils.getLanguage = function () {
	let lang = 'en-GB';
	if (typeof window === 'object' && window.config) {
		lang = utils.params().lang || window.config.userLang || window.config.defaultLang || 'en-GB';
	}
	return lang;
};


utils.makeNumbersHumanReadable = function (elements) {
	elements.each(function () {
		const $this = $(this);
		const toFixed = $this.attr('data-toFixed') || 1;
		$this.html(utils.makeNumberHumanReadable($this.attr('title'), toFixed))
			.removeClass('hidden');
	});
};

utils.addCommasToNumbers = function (elements) {
	elements.each(function (index, element) {
		const $element = $(element);
		$element
			.html(utils.addCommas($element.html()))
			.removeClass('hidden');
	});
};

utils.findBootstrapEnvironment = function () {
	// http://stackoverflow.com/questions/14441456/how-to-detect-which-device-view-youre-on-using-twitter-bootstrap-api
	const envs = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
	const el = document.createElement('div');
	document.body.appendChild(el);
	let curEnv = envs[0];
	for (let i = envs.length - 1; i >= 0; i -= 1) {
		const env = envs[i];
		el.classList.add(`d-${env}-none`);
		if (window.getComputedStyle(el).display === 'none') {
			curEnv = env;
			break;
		}
	}

	document.body.removeChild(el);
	return curEnv;
};

utils.isMobile = function () {
	const env = utils.findBootstrapEnvironment();
	return ['xs', 'sm'].some(function (targetEnv) {
		return targetEnv === env;
	});
};

utils.assertPasswordValidity = (password, zxcvbn) => {
	// More checks on top of basic utils.isPasswordValid()
	if (!utils.isPasswordValid(password)) {
		throw new Error('[[user:change-password-error]]');
	} else if (password.length < ajaxify.data.minimumPasswordLength) {
		throw new Error('[[reset_password:password-too-short]]');
	} else if (password.length > 512) {
		throw new Error('[[error:password-too-long]]');
	}

	const passwordStrength = zxcvbn(password);
	if (passwordStrength.score < ajaxify.data.minimumPasswordStrength) {
		throw new Error('[[user:weak-password]]');
	}
};

utils.generateUUID = function () {
	// from https://github.com/tracker1/node-uuid4/blob/master/browser.js
	const temp_url = URL.createObjectURL(new Blob());
	const uuid = temp_url.toString();
	URL.revokeObjectURL(temp_url);
	return uuid.split(/[:/]/g).pop().toLowerCase(); // remove prefixes
};

module.exports = utils;
