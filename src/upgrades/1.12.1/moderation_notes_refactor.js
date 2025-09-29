/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Update moderation notes to hashes',
	timestamp: Date.UTC(2019, 3, 5),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			const allNotes = await db.getSortedSetsMembers(
				uids.map(uid => `uid:${uid}:moderation:notes`)
			);
			await Promise.all(uids.map(async (uid, index) => {
				const notes = allNotes[index];
				for (const note of notes) {
					const noteData = JSON.parse(note);
					noteData.timestamp = noteData.timestamp || Date.now();
					await db.sortedSetRemove(`uid:${uid}:moderation:notes`, note);
					await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, {
						uid: noteData.uid,
						timestamp: noteData.timestamp,
						note: noteData.note,
					});
					await db.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
				}
			}));
		}, {
			progress: this.progress,
		});
	},
};
