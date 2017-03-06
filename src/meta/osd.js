'use strict';

var xml = require('xml');
var nconf = require('nconf');

var plugins = require('../plugins');

module.exports = function (Meta) {
	Meta.osd = {};
	function generateXML() {
		var osdObject = {
			OpenSearchDescription: [
				{
					_attr: {
						xmlns: 'http://a9.com/-/spec/opensearch/1.1/',
					},
				},
				{
					ShortName: String(Meta.config.title || Meta.config.browserTitle || 'NodeBB'),
				},
				{
					Description: String(Meta.config.description || ''),
				},
				{
					Url: [
						{
							_attr: {
								type: 'text/html',
								method: 'get',
								template: nconf.get('url') + '/search?term={searchTerms}&in=titlesposts',
							},
						},
					],
				},
			],
		};
		return xml([osdObject], { declaration: true, indent: '\t' });
	}
	Meta.osd.handleOSDRequest = function (req, res, next) {
		if (plugins.hasListeners('filter:search.query')) {
			res.type('application/xml').send(generateXML());
		}
		next();
	};
};
