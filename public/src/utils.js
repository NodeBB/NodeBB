(function(module) {

	var utils, fs;

	try {
		fs = require('fs');
	} catch (e) {}


	module.exports = utils = {
		generateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16 | 0,
					v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		//Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
		walk: function(dir, done) {
			var results = [],
				path = require('path'),
				main_dir = path.join(__dirname, '..', 'templates');

			fs.readdir(dir, function(err, list) {
				if (err) return done(err);
				var pending = list.length;
				if (!pending) return done(null, results);
				list.forEach(function(file) {
					file = dir + '/' + file;
					fs.stat(file, function(err, stat) {
						if (stat && stat.isDirectory()) {
							utils.walk(file, function(err, res) {
								results = results.concat(res);
								if (!--pending) done(null, results);
							});
						} else {
							results.push(file.replace(main_dir + '/', '').replace('.tpl', ''));
							if (!--pending) done(null, results);
						}
					});
				});
			});
		},

		relativeTime: function(timestamp, min) {
			var now = +new Date(),
				difference = now - Math.floor(parseFloat(timestamp));

			difference = Math.floor(difference / 1000);

			if (difference < 60) return difference + (min ? 's' : ' second') + (difference !== 1 && !min ? 's' : '');

			difference = Math.floor(difference / 60);
			if (difference < 60) return difference + (min ? 'm' : ' minute') + (difference !== 1 && !min ? 's' : '');

			difference = Math.floor(difference / 60);
			if (difference < 24) return difference + (min ? 'h' : ' hour') + (difference !== 1 && !min ? 's' : '');

			difference = Math.floor(difference / 24);
			if (difference < 30) return difference + (min ? 'd' : ' day') + (difference !== 1 && !min ? 's' : '');

			difference = Math.floor(difference / 30);
			if (difference < 12) return difference + (min ? 'mon' : ' month') + (difference !== 1 && !min ? 's' : '');

			difference = Math.floor(difference / 12);
			return difference + (min ? 'y' : ' year') + (difference !== 1 && !min ? 's' : '');
		},

		//http://dense13.com/blog/2009/05/03/converting-string-to-slug-javascript/
		slugify: function(str) {
			str = str.replace(/^\s+|\s+$/g, ''); // trim
			str = str.toLowerCase();

			// remove accents, swap ñ for n, etc
			var from = "àáäâèéëêìíïîıòóöôùúüûñçşğ·/_,:;";
			var to = "aaaaeeeeiiiiioooouuuuncsg------";
			for (var i = 0, l = from.length; i < l; i++) {
				str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
			}

			str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
			.replace(/\s+/g, '-') // collapse whitespace and replace by -
			.replace(/-+/g, '-'); // collapse dashes

			return str;
		},

		// from http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
		isEmailValid: function(email) {
			// var re = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
			var valid = email.indexOf('@') !== -1 ? true : false;
			return valid;
		},

		isUserNameValid: function(name) {
			return (name && name !== "" && (/^[a-zA-Z0-9 _-]+$/.test(name)));
		},

		isPasswordValid: function(password) {
			return password && password.indexOf(' ') === -1;
		},

		// Blatently stolen from: http://phpjs.org/functions/strip_tags/
		'strip_tags': function(input, allowed) {
			allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
			var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
				commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

			return input.replace(commentsAndPhpTags, '').replace(tags, function($0, $1) {
				return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
			});
		},

		buildMetaTags: function(tagsArr) {
			var tags = '',
				tag;
			for (var x = 0, numTags = tagsArr.length; x < numTags; x++) {
				if (tags.length > 0) tags += "\n\t";
				tag = '<meta';
				for (y in tagsArr[x]) {
					tag += ' ' + y + '="' + tagsArr[x][y] + '"';
				}
				tag += ' />';

				tags += tag;
			}

			return tags;
		},

		refreshTitle: function(url) {
			if (!url) {
				var a = document.createElement('a');
				a.href = document.location;
				url = a.pathname.slice(1);
			}
			var notificationIcon;

			socket.emit('api:meta.buildTitle', url, function(title, numNotifications) {
				document.title = (numNotifications > 0 ? '(' + numNotifications + ') ' : '') + title;
				notificationIcon = notificationIcon || document.querySelector('.notifications a i');
				if (numNotifications > 0 && notificationIcon) notificationIcon.className = 'icon-circle active';
			});

			jQuery.getJSON(RELATIVE_PATH + '/api/unread/total', function(data) {
				var badge = jQuery('#numUnreadBadge');
				badge.html(data.count > 20 ? '20+' : data.count);

				if (data.count > 0) {
					badge
						.removeClass('badge-inverse')
						.addClass('badge-important')
				} else {
					badge
						.removeClass('badge-important')
						.addClass('badge-inverse')
				}
			});
		},

		isRelativeUrl: function(url) {
			var firstChar = url.slice(0, 1);
			return (firstChar === '.' || firstChar === '/');
		}
	}


	if (!String.prototype.trim) {
		String.prototype.trim = function() {
			return this.replace(/^\s+|\s+$/g, '');
		};
	}

	if (!String.prototype.ltrim) {
		String.prototype.ltrim = function() {
			return this.replace(/^\s+/, '');
		};
	}

	if (!String.prototype.rtrim) {
		String.prototype.rtrim = function() {
			return this.replace(/\s+$/, '');
		};
	}

	if (!String.prototype.fulltrim) {
		String.prototype.fulltrim = function() {
			return this.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, '').replace(/\s+/g, ' ');
		};
	}


	if ('undefined' !== typeof window) {
		window.utils = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module)