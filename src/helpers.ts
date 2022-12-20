'use strict';
//@ts-ignore
import commonHelpers from '../../public/src/modules/helpers.common';
import utils from './utils';
import benchpressjs from 'benchpressjs';
import nconf from 'nconf';

export default commonHelpers(
	utils,
	benchpressjs,
	nconf.get('relative_path'),
);

