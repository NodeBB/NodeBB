var	User = require('./user'),
	Plugins = require('./plugins'),
	Meta = require('./meta'),

	Handlebars = require('handlebars'),
	fs = require('fs'),
	async = require('async'),
	path = require('path'),

	Emailer = {},
	templates = {};

var	prepareTemplate = function(template, callback) {
	if (templates[template] === undefined) {
		var	templatePath = path.join(__dirname, '../public/templates/emails/' + template + '.hbs');

		fs.exists(templatePath, function(exists) {
			if (exists) {
				fs.readFile(templatePath, function(err, fileStream) {
					if (!err) {
						templates[template] = Handlebars.compile(fileStream.toString());
					} else {
						templates[template] = null;
					}

					callback();
				});
			} else {
				templates[template] = null;
				callback();
			}
		});
	} else {
		// Template loaded already
		callback();
	}
}

var	render = function(template, params, callback) {
	prepareTemplate(template, function() {
		if (templates[template] !== null) {
			callback(null, templates[template](params));
		} else {
			callback(null, null);
		}
	});
}

Emailer.send = function(template, uid, params) {
	async.parallel({
		html: function(next) {
			render(template, params, next);
		},
		plaintext: function(next) {
			render(template + '_plaintext', params, next);
		}
	}, function(err, results) {
		User.getUserField(uid, 'email', function(err, email) {
			if (!err) {
				Plugins.fireHook('action:email.send', {
					to: email,
					from: Meta.config['email:from'] || 'no-reply@localhost.lan',
					subject: params.subject,
					html: results.html,
					plaintext: results.plaintext,

					template: template,
					uid: uid
				});
			}
		});
	});
};

module.exports = Emailer;