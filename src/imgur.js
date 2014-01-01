var request = require('request'),
	winston = require('winston');


(function (imgur) {
	"use strict";

	imgur.upload = function (clientID, image, type, callback) {
		var options = {
			url: 'https://api.imgur.com/3/upload.json',
			headers: {
				'Authorization': 'Client-ID ' + clientID
			}
		};

		var post = request.post(options, function (err, req, body) {
			if(err) {
				return callback(err, null);
			}

			try {
				var response = JSON.parse(body);

				if(response.success) {
					callback(null, response.data);
				} else {
					callback(new Error(response.data.error.message), null);
				}
			} catch(e) {
				winston.error('Unable to parse Imgur json response. [' + body +']');
				callback(e, null);
			}
		});

		post.form({
			type: type,
			image: image
		});
	};

}(exports));