(function (module) {
	
	var utils, fs;

	try {
		fs = require('fs');
	} catch (e) {}


	module.exports = utils = {
		generateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
				return v.toString(16);
			});
		},

		//Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
		walk: function(dir, done) {
			var main_dir = global.configuration.ROOT_DIRECTORY + '/public/templates/';
			var results = [];
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
							results.push(file.replace(main_dir, '').replace('.tpl', ''));
							if (!--pending) done(null, results);
						}
					});
				});
			});
		},
		
		relativeTime: function(timestamp, min) {
			var	now = +new Date(),
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
			var from = "àáäâèéëêìíïîıòóöôùúüûñçş·/_,:;";
			var to   = "aaaaeeeeiiiiioooouuuuncs------";
			for (var i=0, l=from.length ; i<l ; i++) {
				str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
			}

			str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
					.replace(/\s+/g, '-') // collapse whitespace and replace by -
					.replace(/-+/g, '-'); // collapse dashes

			return str;
		},

		// Blatently stolen from: http://phpjs.org/functions/strip_tags/
		'strip_tags': function(input, allowed) {
			allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
			var	tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
				commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

			return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
				return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
			});
		}
	}

	
	if ('undefined' !== typeof window) {
		window.utils = module.exports;
	}

})('undefined' === typeof module ? {module:{exports:{}}} : module)