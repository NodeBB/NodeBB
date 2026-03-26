'use strict';

$(document).ready(function () {
	/*
		This file shows how admin page client-side javascript can be included via a plugin.
		If you check `plugin.json`, you'll see that this file is listed under "acpScripts".
		That array tells NodeBB which files to bundle into the minified javascript
		that is served to the end user.

		Some events you can elect to listen for:

		$(document).ready(); Fired when the DOM is ready
		$(window).on('action:ajaxify.end', function(data) { ... }); "data" contains "url"
	*/

	console.log('nodebb-plugin-quickstart: acp-loaded');
	// Note how this is shown in the console on the first load of every page in the ACP
});