'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const posts = require('../../posts');
exports.default = {
    name: 'Refresh post-upload associations',
    timestamp: Date.UTC(2018, 3, 16),
    method: function (callback) {
        const { progress } = this;
        require('../../batch').processSortedSet('posts:pid', (pids, next) => {
            async.each(pids, (pid, next) => {
                posts.uploads.sync(pid, next);
                progress.incr();
            }, next);
        }, {
            progress: this.progress,
        }, callback);
    },
};
