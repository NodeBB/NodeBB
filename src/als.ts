'use strict';

import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

export default  asyncLocalStorage;
