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
		if (difference < 60) return difference + ' second' + (difference !== 1 ? 's' : '') + ' ago';
		
		difference = Math.floor(difference / 60);
		if (difference < 60) return difference + ' minute' + (difference !== 1 ? 's' : '') + ' ago';

		difference = Math.floor(difference / 60);
		if (difference < 24) return difference + ' hour' + (difference !== 1 ? 's' : '') + ' ago';

		difference = Math.floor(difference / 24);
		if (difference < 3) return difference + ' day' + (difference !== 1 ? 's' : '') + ' ago';

		// Lastly, just return a formatted date
		var	date = new Date(timestamp);
			// hour = date.getHours(),
			// minute = date.getMinutes(),
			// day = date.getDate(),
			// month = date.getMonth(),
			// months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return date.toDateString();
	}
}

module.exports = utils;