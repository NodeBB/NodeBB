'use strict';

const xml = require('xml');
import nconf from 'nconf';

import plugins from '../plugins';
import meta from '../meta';

export const handle = function (req, res, next) {
	if (plugins.hooks.hasListeners('filter:search.query')) {
		res.type('application/opensearchdescription+xml').send(generateXML());
	} else {
		next();
	}
};

function generateXML() {
	return xml([{
		OpenSearchDescription: [
			{
				_attr: {
					xmlns: 'http://a9.com/-/spec/opensearch/1.1/',
					'xmlns:moz': 'http://www.mozilla.org/2006/browser/search/',
				},
			},
			{ ShortName: trimToLength(String(meta.configs.title || meta.configs.browserTitle || 'NodeBB'), 16) },
			{ Description: trimToLength(String(meta.configs.description || ''), 1024) },
			{ InputEncoding: 'UTF-8' },
			{
				Image: [
					{
						_attr: {
							width: '16',
							height: '16',
							type: 'image/x-icon',
						},
					},
					`${nconf.get('url')}/favicon.ico`,
				],
			},
			{
				Url: {
					_attr: {
						type: 'text/html',
						method: 'get',
						template: `${nconf.get('url')}/search?term={searchTerms}&in=titlesposts`,
					},
				},
			},
			{ 'moz:SearchForm': `${nconf.get('url')}/search` },
		],
	}], { declaration: true, indent: '\t' });
}

function trimToLength(string: string, length: number) {
	return string.trim().substring(0, length).trim();
}
