'use strict';

const cacheCreate = require('./cache/lru').default;
console.log(cacheCreate);

export default  cacheCreate({
	name: 'local',
	max: 40000,
	ttl: 0,
});
