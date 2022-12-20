'use strict';

import winston from 'winston';
import languages from './languages';
//@ts-ignore
import translator from '../../public/src/modules/translator.common';
import utils from './utils';

function warn(msg) {
	winston.warn(msg);
}

export default translator(utils, (lang, namespace) => languages.get(lang, namespace), warn);


