'use strict';

import './helpers/cleanup.mjs';
import { doesNotReject } from 'assert';

describe('Database Mock', function () {
    it('should not throw when loading the database mock', async function () {
        await doesNotReject(async () => {
            await import('./mocks/databasemock.mjs');
        });
    });
});