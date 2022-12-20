'use strict';

import cacheCreate from '../cache/lru';
import Meta from '../meta';

export default cacheCreate({
	name: 'post',
	//@ts-ignore
	maxSize: Meta.config.postCacheSize,
	sizeCalculation: function (n) { return n.length || 1; },
	ttl: 0,
	enabled: (global as any).env === 'production',
});
