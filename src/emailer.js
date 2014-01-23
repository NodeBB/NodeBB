var	User = require('./user'),
	Plugins = require('./plugins'),
	Meta = require('./meta'),
	Translator = require('../public/src/translator'),

	fs = require('fs'),
	async = require('async'),
	path = require('path'),

	Emailer = {};

var	render = function(template, params, callback) {
	if (templates[template] !== null) {
		Translator.translate(templates[template].parse(params), function(template) {
			callback(null, template);
		});
	} else {
		callback(null, null);
	}
}

Emailer.send = function(template, uid, params) {
	console.log(templates);
	async.parallel({
		html: function(next) {
			render('emails/' + template, params, next);
		},
		plaintext: function(next) {
			render('emails/' + template + '_plaintext', params, next);
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