(function(module) {
	'use strict';

	var utils, fs, XRegExp;

	if ('undefined' === typeof window) {
		fs = require('fs');
		XRegExp = require('xregexp').XRegExp;

		process.profile = function(operation, start) {
			console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
		};

		process.elapsedTimeSince = function(start) {
			var diff = process.hrtime(start);
			return diff[0] * 1e3 + diff[1] / 1e6;
		};

	} else {
		XRegExp = window.XRegExp;
	}


	module.exports = utils = {
		generateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16 | 0,
					v = c === 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		//Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
		walk: function(dir, done) {
			var results = [];

			fs.readdir(dir, function(err, list) {
				if (err) {
					return done(err);
				}
				var pending = list.length;
				if (!pending) {
					return done(null, results);
				}
				list.forEach(function(file) {
					file = dir + '/' + file;
					fs.stat(file, function(err, stat) {
						if (stat && stat.isDirectory()) {
							utils.walk(file, function(err, res) {
								results = results.concat(res);
								if (!--pending) {
									done(null, results);
								}
							});
						} else {
							results.push(file);
							if (!--pending) {
								done(null, results);
							}
						}
					});
				});
			});
		},

		relativeTime: function(timestamp, min) {
			var now = +new Date(),
				difference = now - Math.floor(parseFloat(timestamp));

			if(difference < 0) {
				difference = 0;
			}

			difference = Math.floor(difference / 1000);

			if (difference < 60) {
				return difference + (min ? 's' : ' second') + (difference !== 1 && !min ? 's' : '');
			}

			difference = Math.floor(difference / 60);
			if (difference < 60) {
				return difference + (min ? 'm' : ' minute') + (difference !== 1 && !min ? 's' : '');
			}

			difference = Math.floor(difference / 60);
			if (difference < 24) {
				return difference + (min ? 'h' : ' hour') + (difference !== 1 && !min ? 's' : '');
			}

			difference = Math.floor(difference / 24);
			if (difference < 30) {
				return difference + (min ? 'd' : ' day') + (difference !== 1 && !min ? 's' : '');
			}

			difference = Math.floor(difference / 30);
			if (difference < 12) {
				return difference + (min ? 'mon' : ' month') + (difference !== 1 && !min ? 's' : '');
			}

			difference = Math.floor(difference / 12);
			return difference + (min ? 'y' : ' year') + (difference !== 1 && !min ? 's' : '');
		},

		invalidUnicodeChars: XRegExp('[^\\p{L}\\s\\d\\-_]', 'g'),
		invalidLatinChars: /[^\w\s\d\-_]/g,
		trimRegex: /^\s+|\s+$/g,
		collapseWhitespace: /\s+/g,
		collapseDash: /-+/g,
		trimTrailingDash: /-$/g,
		trimLeadingDash: /^-/g,
		isLatin: /^[\w]+$/,

		//http://dense13.com/blog/2009/05/03/converting-string-to-slug-javascript/
		slugify: function(str) {
			str = str.replace(utils.trimRegex, '');
			str = str.toLowerCase();
			if(utils.isLatin.test(str)) {
				str = str.replace(utils.invalidLatinChars, '-');
			} else {
				str = XRegExp.replace(str, utils.invalidUnicodeChars, '-');
			}
			str = str.replace(utils.collapseWhitespace, '-')
			str = str.replace(utils.collapseDash, '-');
			str = str.replace(utils.trimTrailingDash, '');
			str = str.replace(utils.trimLeadingDash, '');
			return str;
		},


		isEmailValid: function(email) {
			return typeof email === 'string' && email.length && email.indexOf('@') !== -1;
		},

		isUserNameValid: function(name) {
			return (name && name !== '' && (/^['"\s\-.*0-9\u00BF-\u1FFF\u2C00-\uD7FF\w]+$/.test(name)));
		},

		isPasswordValid: function(password) {
			return typeof password === 'string' && password.length && password.indexOf(' ') === -1;
		},

		isNumber: function(n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		},

		// shallow objects merge
		merge: function() {
			var result = {}, obj, keys;
			for (var i = 0; i < arguments.length; i++) {
				obj = arguments[i] || {};
				keys = Object.keys(obj);
				for (var j = 0; j < keys.length; j++) {
					result[keys[j]] = obj[keys[j]];
				}
			}
			return result;
		},

		fileExtension: function (path) {
			return ('' + path).split('.').pop();
		},

		fileMimeType: (function () {
			// we only care about images, for now
			var map = {
				"bmp": "image/bmp",
				"cmx": "image/x-cmx",
				"cod": "image/cis-cod",
				"gif": "image/gif",
				"ico": "image/x-icon",
				"ief": "image/ief",
				"jfif": "image/pipeg",
				"jpe": "image/jpeg",
				"jpeg": "image/jpeg",
				"jpg": "image/jpeg",
				"pbm": "image/x-portable-bitmap",
				"pgm": "image/x-portable-graymap",
				"pnm": "image/x-portable-anymap",
				"ppm": "image/x-portable-pixmap",
				"ras": "image/x-cmu-raster",
				"rgb": "image/x-rgb",
				"svg": "image/svg+xml",
				"tif": "image/tiff",
				"tiff": "image/tiff",
				"xbm": "image/x-xbitmap",
				"xpm": "image/x-xpixmap",
				"xwd": "image/x-xwindowdump"
			};

			return function (path) {
				var extension = utils.fileExtension(path);
				return map[extension] || '*';
			}
		})(),

		isRelativeUrl: function(url) {
			var firstChar = url.slice(0, 1);
			return (firstChar === '.' || firstChar === '/');
		},

		makeNumbersHumanReadable: function(elements) {
			elements.each(function() {
				$(this).html(utils.makeNumberHumanReadable($(this).attr('title')));
			});
		},

		makeNumberHumanReadable: function(num) {
			var n = parseInt(num, 10);
			if(!n) {
				return num;
			}
			if (n > 999999) {
				return (n / 1000000).toFixed(1) + 'm';
			}
			else if(n > 999) {
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
			return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
		},

		toISOString: function(timestamp) {
			if(!timestamp) {
				return '';
			}

			try {
				return new Date(parseInt(timestamp, 10)).toISOString();
			} catch(e){
				console.log(timestamp, e.stack);
			}
			return '';
		},

		tags : ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'big', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'command', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'small', 'source', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr'],

		getTagsExcept: function(excludeTags) {
			var tagsToReturn = utils.tags.slice();
			excludeTags.forEach(function(tag) {
				var index = tagsToReturn.indexOf(tag);
				if(index !== -1) {
					tagsToReturn.splice(index, 1);
				}
			});
			return tagsToReturn;
		},

		escapeRegexChars: function(text) {
			return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
		},

		isAndroidBrowser: function() {
			// http://stackoverflow.com/questions/9286355/how-to-detect-only-the-native-android-browser
			var nua = navigator.userAgent;
			return ((nua.indexOf('Mozilla/5.0') > -1 && nua.indexOf('Android ') > -1 && nua.indexOf('AppleWebKit') > -1) && !(nua.indexOf('Chrome') > -1));
		}
	};

	if ('undefined' !== typeof window) {
		window.utils = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);