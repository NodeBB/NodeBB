'use strict';


const fs = require('fs');
const nconf = require('nconf');
const path = require('path');
const { mkdirp } = require('mkdirp');

const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Create user upload folders',
	timestamp: Date.UTC(2024, 2, 28),
	method: async function () {
		const { progress } = this;

		const folder = path.join(nconf.get('upload_path'), 'profile');

		const userPicRegex = /^\d+-profile/;
		const files = (await fs.promises.readdir(folder, { withFileTypes: true }))
			.filter(item => !item.isDirectory() && String(item.name).match(userPicRegex))
			.map(item => item.name);

		progress.total = files.length;
		await batch.processArray(files, async (files) => {
			progress.incr(files.length);
			await Promise.all(files.map(async (file) => {
				const uid = file.split('-')[0];
				if (parseInt(uid, 10) > 0) {
					await mkdirp(path.join(folder, `uid-${uid}`));
					await fs.promises.rename(
						path.join(folder, file),
						path.join(folder, `uid-${uid}`, file),
					);
				}
			}));
		}, {
			batch: 500,
		});

		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			const usersData = await db.getObjects(uids.map(uid => `user:${uid}`));
			const bulkSet = [];
			usersData.forEach((userData) => {
				const setObj = {};
				if (userData && userData.picture &&
					userData.picture.includes(`/uploads/profile/${userData.uid}-`) &&
					!userData.picture.includes(`/uploads/profile/uid-${userData.uid}/${userData.uid}-`)) {
					setObj.picture = userData.picture.replace(
						`/uploads/profile/${userData.uid}-`,
						`/uploads/profile/uid-${userData.uid}/${userData.uid}-`
					);
				}

				if (userData && userData.uploadedpicture &&
					userData.uploadedpicture.includes(`/uploads/profile/${userData.uid}-`) &&
					!userData.uploadedpicture.includes(`/uploads/profile/uid-${userData.uid}/${userData.uid}-`)) {
					setObj.uploadedpicture = userData.uploadedpicture.replace(
						`/uploads/profile/${userData.uid}-`,
						`/uploads/profile/uid-${userData.uid}/${userData.uid}-`
					);
				}

				if (userData && userData['cover:url'] &&
					userData['cover:url'].includes(`/uploads/profile/${userData.uid}-`) &&
					!userData['cover:url'].includes(`/uploads/profile/uid-${userData.uid}/${userData.uid}-`)) {
					setObj['cover:url'] = userData['cover:url'].replace(
						`/uploads/profile/${userData.uid}-`,
						`/uploads/profile/uid-${userData.uid}/${userData.uid}-`
					);
				}

				if (Object.keys(setObj).length) {
					bulkSet.push([`user:${userData.uid}`, setObj]);
				}
			});
			await db.setObjectBulk(bulkSet);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
