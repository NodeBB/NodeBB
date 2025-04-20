'use strict';

import './cleanup.mjs';
import { doesNotReject } from 'assert';
import winston from 'winston';

describe('Test database mock', function () {
    it('should not throw when loading the database mock', async function () {
        winston.verbose('Loading database mock...');
        await doesNotReject(async () => {
            await import('./mocks/databasemock.mjs');
        });
    });
});