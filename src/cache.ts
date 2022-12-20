'use strict';

import cacheCreate from './cache/lru';

export default  cacheCreate({
	name: 'local',
	max: 40000,
	ttl: 0,
});
