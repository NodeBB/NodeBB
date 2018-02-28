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
	var freeze = Object.freeze || function (obj) { return obj; };

	// add default escape function for escaping HTML entities
	var escapeCharMap = freeze({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'`': '&#x60;',
		'=': '&#x3D;',
	});
	function replaceChar(c) {
		return escapeCharMap[c];
	}
	var escapeChars = /[&<>"'`=]/g;

	var HTMLEntities = freeze({
		amp: '&',
		gt: '>',
		lt: '<',
		quot: '"',
		apos: "'",
		AElig: 198,
		Aacute: 193,
		Acirc: 194,
		Agrave: 192,
		Aring: 197,
		Atilde: 195,
		Auml: 196,
		Ccedil: 199,
		ETH: 208,
		Eacute: 201,
		Ecirc: 202,
		Egrave: 200,
		Euml: 203,
		Iacute: 205,
		Icirc: 206,
		Igrave: 204,
		Iuml: 207,
		Ntilde: 209,
		Oacute: 211,
		Ocirc: 212,
		Ograve: 210,
		Oslash: 216,
		Otilde: 213,
		Ouml: 214,
		THORN: 222,
		Uacute: 218,
		Ucirc: 219,
		Ugrave: 217,
		Uuml: 220,
		Yacute: 221,
		aacute: 225,
		acirc: 226,
		aelig: 230,
		agrave: 224,
		aring: 229,
		atilde: 227,
		auml: 228,
		ccedil: 231,
		eacute: 233,
		ecirc: 234,
		egrave: 232,
		eth: 240,
		euml: 235,
		iacute: 237,
		icirc: 238,
		igrave: 236,
		iuml: 239,
		ntilde: 241,
		oacute: 243,
		ocirc: 244,
		ograve: 242,
		oslash: 248,
		otilde: 245,
		ouml: 246,
		szlig: 223,
		thorn: 254,
		uacute: 250,
		ucirc: 251,
		ugrave: 249,
		uuml: 252,
		yacute: 253,
		yuml: 255,
		copy: 169,
		reg: 174,
		nbsp: 160,
		iexcl: 161,
		cent: 162,
		pound: 163,
		curren: 164,
		yen: 165,
		brvbar: 166,
		sect: 167,
		uml: 168,
		ordf: 170,
		laquo: 171,
		not: 172,
		shy: 173,
		macr: 175,
		deg: 176,
		plusmn: 177,
		sup1: 185,
		sup2: 178,
		sup3: 179,
		acute: 180,
		micro: 181,
		para: 182,
		middot: 183,
		cedil: 184,
		ordm: 186,
		raquo: 187,
		frac14: 188,
		frac12: 189,
		frac34: 190,
		iquest: 191,
		times: 215,
		divide: 247,
		'OElig;': 338,
		'oelig;': 339,
		'Scaron;': 352,
		'scaron;': 353,
		'Yuml;': 376,
		'fnof;': 402,
		'circ;': 710,
		'tilde;': 732,
		'Alpha;': 913,
		'Beta;': 914,
		'Gamma;': 915,
		'Delta;': 916,
		'Epsilon;': 917,
		'Zeta;': 918,
		'Eta;': 919,
		'Theta;': 920,
		'Iota;': 921,
		'Kappa;': 922,
		'Lambda;': 923,
		'Mu;': 924,
		'Nu;': 925,
		'Xi;': 926,
		'Omicron;': 927,
		'Pi;': 928,
		'Rho;': 929,
		'Sigma;': 931,
		'Tau;': 932,
		'Upsilon;': 933,
		'Phi;': 934,
		'Chi;': 935,
		'Psi;': 936,
		'Omega;': 937,
		'alpha;': 945,
		'beta;': 946,
		'gamma;': 947,
		'delta;': 948,
		'epsilon;': 949,
		'zeta;': 950,
		'eta;': 951,
		'theta;': 952,
		'iota;': 953,
		'kappa;': 954,
		'lambda;': 955,
		'mu;': 956,
		'nu;': 957,
		'xi;': 958,
		'omicron;': 959,
		'pi;': 960,
		'rho;': 961,
		'sigmaf;': 962,
		'sigma;': 963,
		'tau;': 964,
		'upsilon;': 965,
		'phi;': 966,
		'chi;': 967,
		'psi;': 968,
		'omega;': 969,
		'thetasym;': 977,
		'upsih;': 978,
		'piv;': 982,
		'ensp;': 8194,
		'emsp;': 8195,
		'thinsp;': 8201,
		'zwnj;': 8204,
		'zwj;': 8205,
		'lrm;': 8206,
		'rlm;': 8207,
		'ndash;': 8211,
		'mdash;': 8212,
		'lsquo;': 8216,
		'rsquo;': 8217,
		'sbquo;': 8218,
		'ldquo;': 8220,
		'rdquo;': 8221,
		'bdquo;': 8222,
		'dagger;': 8224,
		'Dagger;': 8225,
		'bull;': 8226,
		'hellip;': 8230,
		'permil;': 8240,
		'prime;': 8242,
		'Prime;': 8243,
		'lsaquo;': 8249,
		'rsaquo;': 8250,
		'oline;': 8254,
		'frasl;': 8260,
		'euro;': 8364,
		'image;': 8465,
		'weierp;': 8472,
		'real;': 8476,
		'trade;': 8482,
		'alefsym;': 8501,
		'larr;': 8592,
		'uarr;': 8593,
		'rarr;': 8594,
		'darr;': 8595,
		'harr;': 8596,
		'crarr;': 8629,
		'lArr;': 8656,
		'uArr;': 8657,
		'rArr;': 8658,
		'dArr;': 8659,
		'hArr;': 8660,
		'forall;': 8704,
		'part;': 8706,
		'exist;': 8707,
		'empty;': 8709,
		'nabla;': 8711,
		'isin;': 8712,
		'notin;': 8713,
		'ni;': 8715,
		'prod;': 8719,
		'sum;': 8721,
		'minus;': 8722,
		'lowast;': 8727,
		'radic;': 8730,
		'prop;': 8733,
		'infin;': 8734,
		'ang;': 8736,
		'and;': 8743,
		'or;': 8744,
		'cap;': 8745,
		'cup;': 8746,
		'int;': 8747,
		'there4;': 8756,
		'sim;': 8764,
		'cong;': 8773,
		'asymp;': 8776,
		'ne;': 8800,
		'equiv;': 8801,
		'le;': 8804,
		'ge;': 8805,
		'sub;': 8834,
		'sup;': 8835,
		'nsub;': 8836,
		'sube;': 8838,
		'supe;': 8839,
		'oplus;': 8853,
		'otimes;': 8855,
		'perp;': 8869,
		'sdot;': 8901,
		'lceil;': 8968,
		'rceil;': 8969,
		'lfloor;': 8970,
		'rfloor;': 8971,
		'lang;': 9001,
		'rang;': 9002,
		'loz;': 9674,
		'spades;': 9824,
		'clubs;': 9827,
		'hearts;': 9829,
		'diams;': 9830,
	});

	var utils = {
		generateUUID: function () {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r = Math.random() * 16 | 0;
				var v = c === 'x' ? r : ((r & 0x3) | 0x8);
				return v.toString(16);
			});
		},
		// https://github.com/substack/node-ent/blob/master/index.js
		decodeHTMLEntities: function (html) {
			return String(html)
				.replace(/&#(\d+);?/g, function (_, code) {
					return String.fromCharCode(code);
				})
				.replace(/&#[xX]([A-Fa-f0-9]+);?/g, function (_, hex) {
					return String.fromCharCode(parseInt(hex, 16));
				})
				.replace(/&([^;\W]+;?)/g, function (m, e) {
					var ee = e.replace(/;$/, '');
					var target = HTMLEntities[e] || (e.match(/;$/) && HTMLEntities[ee]);

					if (typeof target === 'number') {
						return String.fromCharCode(target);
					} else if (typeof target === 'string') {
						return target;
					}

					return m;
				});
		},
		// https://github.com/jprichardson/string.js/blob/master/lib/string.js
		stripHTMLTags: function (str, tags) {
			var pattern = (tags || ['']).map(function (tag) {
				return utils.escapeRegexChars(tag);
			}).join('|');
			return String(str).replace(new RegExp('<(\\/)?(' + (pattern || '[^\\s>]+') + ')(\\s+[^<>]*?)?\\s*(\\/)?>', 'gi'), '');
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
			return typeof email === 'string' && email.length && email.indexOf('@') !== -1 && email.indexOf(',') === -1 && email.indexOf(';') === -1;
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
		userLangToTimeagoCode: function (userLang) {
			var mapping = {
				'en-GB': 'en',
				'en-US': 'en',
				'fa-IR': 'fa',
				'pt-BR': 'pt-br',
				nb: 'no',
			};
			return mapping[userLang] || userLang;
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

		tags: ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont',
			'bdi', 'bdo', 'big', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup',
			'command', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'embed',
			'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'head', 'header', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'legend', 'li', 'link',
			'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option',
			'output', 'p', 'param', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select',
			'small', 'source', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot',
			'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr'],

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

		escapeHTML: function (str) {
			if (str == null) {
				return '';
			}
			if (!str) {
				return String(str);
			}

			return str.toString().replace(escapeChars, replaceChar);
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

		debounce: function (func, wait, immediate) {
			// modified from https://davidwalsh.name/javascript-debounce-function
			var timeout;
			return function () {
				var context = this;
				var args = arguments;
				var later = function () {
					timeout = null;
					if (!immediate) {
						func.apply(context, args);
					}
				};
				var callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
				if (callNow) {
					func.apply(context, args);
				}
			};
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

	return utils;
}));
