'use strict';

const topics = require('../topics');

const tagsAPI = module.exports;

tagsAPI.follow = async function (caller, data) {
	await topics.followTag(data.tag, caller.uid);
};

tagsAPI.unfollow = async function (caller, data) {
	await topics.unfollowTag(data.tag, caller.uid);
};
