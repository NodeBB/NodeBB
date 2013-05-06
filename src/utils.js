var utils = {
	generateUUID: function() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	},
	
	relativeTime: function(timestamp) {
		var	now = +new Date(),
			difference = now - Math.floor(parseFloat(timestamp));

		difference = Math.floor(difference / 1000);
		if (difference < 60) return difference + ' second' + (difference !== 1 ? 's' : '');
		
		difference = Math.floor(difference / 60);
		if (difference < 60) return difference + ' minute' + (difference !== 1 ? 's' : '');

		difference = Math.floor(difference / 60);
		if (difference < 24) return difference + ' hour' + (difference !== 1 ? 's' : '');

		difference = Math.floor(difference / 24);
		if (difference < 3) return difference + ' day' + (difference !== 1 ? 's' : '');

		// Lastly, just return a formatted date
		var	date = new Date(timestamp);
			// hour = date.getHours(),
			// minute = date.getMinutes(),
			// day = date.getDate(),
			// month = date.getMonth(),
			// months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return date.toDateString();
	},
	
	//http://dense13.com/blog/2009/05/03/converting-string-to-slug-javascript/
	slugify: function(str) {
		str = str.replace(/^\s+|\s+$/g, ''); // trim
		str = str.toLowerCase();

		// remove accents, swap ñ for n, etc
		var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
		var to   = "aaaaeeeeiiiioooouuuunc------";
		for (var i=0, l=from.length ; i<l ; i++) {
			str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
		}

		str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
				.replace(/\s+/g, '-') // collapse whitespace and replace by -
				.replace(/-+/g, '-'); // collapse dashes

		return str;
	}

}

module.exports = utils;