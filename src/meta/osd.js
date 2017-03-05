'use strict';

var path = require('path');
var xml = require('xml');
var fs = require('fs');
var nconf = require('nconf');

var osdFilePath = path.join(__dirname, '../../build/public/osd.xml');

module.exports = function (Meta) {
	Meta.osd = {};
	Meta.osd.build = function (callback) {
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
		fs.writeFile(osdFilePath, xml([osdObject], { declaration: true, indent: '\t' }), callback);
	};
};
