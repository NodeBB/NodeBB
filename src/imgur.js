var request = require('request');


(function(imgur) {
	var clientID = '';

	imgur.upload = function(image, type, callback) {
		var options = {
			url: 'https://api.imgur.com/3/upload.json',
			headers: {
				'Authorization': 'Client-ID ' + clientID
			}
		};

		var post = request.post(options, function(err, req, body) {
			try {
				callback(err, JSON.parse(body));
			} catch (e) {
				callback(err, body);
			}
		});

		var upload = post.form({
			type: type,
			image: image
		});
	}

	imgur.setClientID = function(id) {
		clientID = id;
	}

}(exports));