'use strict';

(function (factory) {
	if (typeof module === 'object' && module.exports) {
		var winston = require('winston');


		module.exports = factory(require('xregexp'));
		module.exports.walk = function (dir, done) {
			// DEPRECATED
			var file = require('../../src/file');
			winston.warn('[deprecated] `utils.walk` is deprecated. Use `file.walk` instead.');
			file.walk(dir, done);
		};

		process.profile = function (operation, start) {
			console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
		};

		process.elapsedTimeSince = function (start) {
			var diff = process.hrtime(start);
			return (diff[0] * 1e3) + (diff[1] / 1e6);
		};
	} else {
		window.utils = factory(window.XRegExp);
	}
}(function (XRegExp) {
	var utils = {
		generateUUID: function () {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r = Math.random() * 16 | 0;
				var v = c === 'x' ? r : ((r & 0x3) | 0x8);
				return v.toString(16);
			});
		},

		invalidUnicodeChars: XRegExp('[^\\p{L}\\s\\d\\-_]', 'g'),
		invalidLatinChars: /[^\w\s\d\-_]/g,
		trimRegex: /^\s+|\s+$/g,
		collapseWhitespace: /\s+/g,
		collapseDash: /-+/g,
		trimTrailingDash: /-$/g,
		trimLeadingDash: /^-/g,
		isLatin: /^[\w\d\s.,\-@]+$/,
		languageKeyRegex: /\[\[[\w]+:.+\]\]/,

		// http://dense13.com/blog/2009/05/03/converting-string-to-slug-javascript/
		slugify: function (str, preserveCase) {
			if (!str) {
				return '';
			}
			str = str.replace(utils.trimRegex, '');
			if (utils.isLatin.test(str)) {
				str = str.replace(utils.invalidLatinChars, '-');
			} else {
				str = XRegExp.replace(str, utils.invalidUnicodeChars, '-');
			}
			str = !preserveCase ? str.toLocaleLowerCase() : str;
			str = str.replace(utils.collapseWhitespace, '-');
			str = str.replace(utils.collapseDash, '-');
			str = str.replace(utils.trimTrailingDash, '');
			str = str.replace(utils.trimLeadingDash, '');
			return str;
		},

		cleanUpTag: function (tag, maxLength) {
			if (typeof tag !== 'string' || !tag.length) {
				return '';
			}

			tag = tag.trim().toLowerCase();
			// see https://github.com/NodeBB/NodeBB/issues/4378
			tag = tag.replace(/\u202E/gi, '');
			tag = tag.replace(/[,/#!$%^*;:{}=_`<>'"~()?|]/g, '');
			tag = tag.substr(0, maxLength || 15).trim();
			var matches = tag.match(/^[.-]*(.+?)[.-]*$/);
			if (matches && matches.length > 1) {
				tag = matches[1];
			}
			return tag;
		},

		removePunctuation: function (str) {
			return str.replace(/[.,-/#!$%^&*;:{}=\-_`<>'"~()?]/g, '');
		},

		isEmailValid: function (email) {
			return typeof email === 'string' && email.length && email.indexOf('@') !== -1;
		},

		isUserNameValid: function (name) {
			return (name && name !== '' && (/^['"\s\-+.*0-9\u00BF-\u1FFF\u2C00-\uD7FF\w]+$/.test(name)));
		},

		isPasswordValid: function (password) {
			return typeof password === 'string' && password.length;
		},

		isNumber: function (n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		},

		hasLanguageKey: function (input) {
			return utils.languageKeyRegex.test(input);
		},

		// shallow objects merge
		merge: function () {
			var result = {};
			var obj;
			var keys;
			for (var i = 0; i < arguments.length; i += 1) {
				obj = arguments[i] || {};
				keys = Object.keys(obj);
				for (var j = 0; j < keys.length; j += 1) {
					result[keys[j]] = obj[keys[j]];
				}
			}
			return result;
		},

		fileExtension: function (path) {
			return ('' + path).split('.').pop();
		},

		extensionMimeTypeMap: {
			bmp: 'image/bmp',
			cmx: 'image/x-cmx',
			cod: 'image/cis-cod',
			gif: 'image/gif',
			ico: 'image/x-icon',
			ief: 'image/ief',
			jfif: 'image/pipeg',
			jpe: 'image/jpeg',
			jpeg: 'image/jpeg',
			jpg: 'image/jpeg',
			png: 'image/png',
			pbm: 'image/x-portable-bitmap',
			pgm: 'image/x-portable-graymap',
			pnm: 'image/x-portable-anymap',
			ppm: 'image/x-portable-pixmap',
			ras: 'image/x-cmu-raster',
			rgb: 'image/x-rgb',
			svg: 'image/svg+xml',
			tif: 'image/tiff',
			tiff: 'image/tiff',
			xbm: 'image/x-xbitmap',
			xpm: 'image/x-xpixmap',
			xwd: 'image/x-xwindowdump',
		},

		fileMimeType: function (path) {
			return utils.extensionToMimeType(utils.fileExtension(path));
		},

		extensionToMimeType: function (extension) {
			return utils.extensionMimeTypeMap[extension] || '*';
		},

		isRelativeUrl: function (url) {
			var firstChar = String(url || '').charAt(0);
			return (firstChar === '.' || firstChar === '/');
		},

		makeNumbersHumanReadable: function (elements) {
			elements.each(function () {
				$(this).html(utils.makeNumberHumanReadable($(this).attr('title')));
			});
		},

		makeNumberHumanReadable: function (num) {
			var n = parseInt(num, 10);
			if (!n) {
				return num;
			}
			if (n > 999999) {
				return (n / 1000000).toFixed(1) + 'm';
			} else if (n > 999) {
				return (n / 1000).toFixed(1) + 'k';
			}
			return n;
		},

		addCommasToNumbers: function (elements) {
			elements.each(function (index, element) {
				$(element).html(utils.addCommas($(element).html()));
			});
		},

		// takes a string like 1000 and returns 1,000
		addCommas: function (text) {
			return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
		},

		toISOString: function (timestamp) {
			if (!timestamp || !Date.prototype.toISOString) {
				return '';
			}

			// Prevent too-high values to be passed to Date object
			timestamp = Math.min(timestamp, 8640000000000000);

			try {
				return Date.prototype.toISOString ? new Date(parseInt(timestamp, 10)).toISOString() : timestamp;
			} catch (e) {
				return timestamp;
			}
		},

		tags: ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'big', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'command', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'small', 'source', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr'],

		stripTags: ['abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'base', 'basefont',
			'bdi', 'bdo', 'big', 'blink', 'body', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup',
			'command', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'embed',
			'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'head', 'header', 'hr', 'html', 'iframe', 'input', 'ins', 'kbd', 'keygen', 'label', 'legend', 'li', 'link',
			'map', 'mark', 'marquee', 'menu', 'meta', 'meter', 'nav', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option',
			'output', 'param', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select',
			'source', 'span', 'strike', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot',
			'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr'],

		escapeRegexChars: function (text) {
			return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
		},

		escapeHTML: function (raw) {
			return raw.replace(/&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;');
		},

		isAndroidBrowser: function () {
			// http://stackoverflow.com/questions/9286355/how-to-detect-only-the-native-android-browser
			var nua = navigator.userAgent;
			return ((nua.indexOf('Mozilla/5.0') > -1 && nua.indexOf('Android ') > -1 && nua.indexOf('AppleWebKit') > -1) && !(nua.indexOf('Chrome') > -1));
		},

		isTouchDevice: function () {
			return 'ontouchstart' in document.documentElement;
		},

		findBootstrapEnvironment: function () {
			// http://stackoverflow.com/questions/14441456/how-to-detect-which-device-view-youre-on-using-twitter-bootstrap-api
			var envs = ['xs', 'sm', 'md', 'lg'];
			var $el = $('<div>');

			$el.appendTo($('body'));

			for (var i = envs.length - 1; i >= 0; i -= 1) {
				var env = envs[i];

				$el.addClass('hidden-' + env);
				if ($el.is(':hidden')) {
					$el.remove();
					return env;
				}
			}
		},

		isMobile: function () {
			var env = utils.findBootstrapEnvironment();
			return ['xs', 'sm'].some(function (targetEnv) {
				return targetEnv === env;
			});
		},

		getHoursArray: function () {
			var currentHour = new Date().getHours();
			var labels = [];

			for (var i = currentHour, ii = currentHour - 24; i > ii; i -= 1) {
				var hour = i < 0 ? 24 + i : i;
				labels.push(hour + ':00');
			}

			return labels.reverse();
		},

		getDaysArray: function (from, amount) {
			var currentDay = new Date(from || Date.now()).getTime();
			var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			var labels = [];
			var tmpDate;

			for (var x = (amount || 30) - 1; x >= 0; x -= 1) {
				tmpDate = new Date(currentDay - (1000 * 60 * 60 * 24 * x));
				labels.push(months[tmpDate.getMonth()] + ' ' + tmpDate.getDate());
			}

			return labels;
		},

		/* Retrieved from http://stackoverflow.com/a/7557433 @ 27 Mar 2016 */
		isElementInViewport: function (el) {
			// special bonus for those using jQuery
			if (typeof jQuery === 'function' && el instanceof jQuery) {
				el = el[0];
			}

			var rect = el.getBoundingClientRect();

			return (
				rect.top >= 0 &&
				rect.left >= 0 &&
				rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
				rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
			);
		},

		// get all the url params in a single key/value hash
		params: function (options) {
			var a;
			var hash = {};
			var params;

			options = options || {};
			options.skipToType = options.skipToType || {};

			if (options.url) {
				a = utils.urlToLocation(options.url);
			}
			params = (a ? a.search : window.location.search).substring(1).split('&');

			params.forEach(function (param) {
				var val = param.split('=');
				var key = decodeURI(val[0]);
				var value = options.skipToType[key] ? decodeURI(val[1]) : utils.toType(decodeURI(val[1]));

				if (key) {
					if (key.substr(-2, 2) === '[]') {
						key = key.slice(0, -2);
					}
					if (!hash[key]) {
						hash[key] = value;
					} else {
						if (!$.isArray(hash[key])) {
							hash[key] = [hash[key]];
						}
						hash[key].push(value);
					}
				}
			});
			return hash;
		},

		param: function (key) {
			return this.params()[key];
		},

		urlToLocation: function (url) {
			return $('<a href="' + url + '" />')[0];
		},

		// return boolean if string 'true' or string 'false', or if a parsable string which is a number
		// also supports JSON object and/or arrays parsing
		toType: function (str) {
			var type = typeof str;
			if (type !== 'string') {
				return str;
			}
			var nb = parseFloat(str);
			if (!isNaN(nb) && isFinite(str)) {
				return nb;
			}
			if (str === 'false') {
				return false;
			}
			if (str === 'true') {
				return true;
			}

			try {
				str = JSON.parse(str);
			} catch (e) {}

			return str;
		},

		// Safely get/set chained properties on an object
		// set example: utils.props(A, 'a.b.c.d', 10) // sets A to {a: {b: {c: {d: 10}}}}, and returns 10
		// get example: utils.props(A, 'a.b.c') // returns {d: 10}
		// get example: utils.props(A, 'a.b.c.foo.bar') // returns undefined without throwing a TypeError
		// credits to github.com/gkindel
		props: function (obj, props, value) {
			if (obj === undefined) {
				obj = window;
			}
			if (props == null) {
				return undefined;
			}
			var i = props.indexOf('.');
			if (i === -1) {
				if (value !== undefined) {
					obj[props] = value;
				}
				return obj[props];
			}
			var prop = props.slice(0, i);
			var newProps = props.slice(i + 1);

			if (props !== undefined && !(obj[prop] instanceof Object)) {
				obj[prop] = {};
			}

			return utils.props(obj[prop], newProps, value);
		},

		isInternalURI: function (targetLocation, referenceLocation, relative_path) {
			return targetLocation.host === '' ||	// Relative paths are always internal links
				(
					targetLocation.host === referenceLocation.host && targetLocation.protocol === referenceLocation.protocol &&	// Otherwise need to check if protocol and host match
					(relative_path.length > 0 ? targetLocation.pathname.indexOf(relative_path) === 0 : true)	// Subfolder installs need this additional check
				);
		},

		rtrim: function (str) {
			return str.replace(/\s+$/g, '');
		},
	};

	/* eslint "no-extend-native": "off" */
	if (typeof String.prototype.startsWith !== 'function') {
		String.prototype.startsWith = function (prefix) {
			if (this.length < prefix.length) {
				return false;
			}
			return this.slice(0, prefix.length) === prefix;
		};
	}

	if (typeof String.prototype.endsWith !== 'function') {
		String.prototype.endsWith = function (suffix) {
			if (this.length < suffix.length) {
				return false;
			}
			if (suffix.length === 0) {
				return true;
			}
			return this.slice(-suffix.length) === suffix;
		};
	}

	// DEPRECATED: remove in 1.6
	if (typeof String.prototype.rtrim !== 'function') {
		String.prototype.rtrim = function () {
			console.warn('[deprecated] `String.prototype.rtrim` is deprecated as of NodeBB v1.5; use `utils.rtrim` instead.');
			return utils.rtrim(this);
		};
	}

	return utils;
}));
