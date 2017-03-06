'use strict';

var xml = require('xml');
var nconf = require('nconf');

var plugins = require('../plugins');
var meta = require('../meta');

module.exports = function (req, res, next) {
	if (plugins.hasListeners('filter:search.query')) {
		res.type('application/xml').send(generateXML());
	} else {
		next();
	}
};

function generateXML() {
	return xml([{
		OpenSearchDescription: [
			{ _attr: { xmlns: 'http://a9.com/-/spec/opensearch/1.1/' }},
			{ ShortName: String(meta.config.title || meta.config.browserTitle || 'NodeBB') },
			{ Description: String(meta.config.description || '') },
			{ Url: [{
				_attr: {
					type: 'text/html',
					method: 'get',
					template: nconf.get('url') + '/search?term={searchTerms}&in=titlesposts',
				},
			}]},
		],
	}], { declaration: true, indent: '\t' });
}
