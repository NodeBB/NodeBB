'use strict';


const cacheCreate = require('../cache/lru').default;
console.log('CACHE CREATE', cacheCreate);
import meta from '../meta';

export default  cacheCreate({
	name: 'post',
	maxSize: meta.config.postCacheSize,
	sizeCalculation: function (n) { return n.length || 1; },
	ttl: 0,
	enabled: global.env === 'production',
});
