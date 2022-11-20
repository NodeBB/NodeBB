'use strict';

import winston from 'winston';

function warn(msg) {
	winston.warn(msg);
}

export default  require('../../public/src/modules/translator.common')(require('./utils'), (lang, namespace) => {
	const languages = require('./languages');
	return languages.get(lang, namespace);
}, warn);
