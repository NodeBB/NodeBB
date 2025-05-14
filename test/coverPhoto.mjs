import assert from 'assert';
import nconf from 'nconf';

import './mocks/databasemock.mjs';
import coverPhoto from '../src/coverPhoto.js';
import meta from '../src/meta/index.js';

describe('coverPhoto', () => {
    it('should get default group cover', async () => {
        meta.config['groups:defaultCovers'] = '/assets/image1.png, /assets/image2.png';
        const result = coverPhoto.getDefaultGroupCover('registered-users');
        assert.equal(result, `${nconf.get('relative_path')}/assets/image2.png`);
    });

    it('should get default profile cover', async () => {
        meta.config['profile:defaultCovers'] = ' /assets/image1.png, /assets/image2.png ';
        const result = coverPhoto.getDefaultProfileCover(1);
        assert.equal(result, `${nconf.get('relative_path')}/assets/image2.png`);
    });
});