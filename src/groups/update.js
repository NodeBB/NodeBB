'use strict';

var async = require('async'),
	winston = require('winston'),
	crypto = require('crypto'),
	path = require('path'),
	nconf = require('nconf'),
	fs = require('fs'),

	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	db = require('../database'),

	uploadsController = require('../controllers/uploads');

module.exports = function(Groups) {

	Groups.update = function(groupName, values, callback) {
		callback = callback || function() {};
		db.exists('group:' + groupName, function (err, exists) {
			if (err || !exists) {
				return callback(err || new Error('[[error:no-group]]'));
			}

			var payload = {
				description: values.description || '',
				icon: values.icon || '',
				labelColor: values.labelColor || '#000000'
			};

			if (values.hasOwnProperty('userTitle')) {
				payload.userTitle = values.userTitle || '';
			}

			if (values.hasOwnProperty('userTitleEnabled')) {
				payload.userTitleEnabled = values.userTitleEnabled ? '1' : '0';
			}

			if (values.hasOwnProperty('hidden')) {
				payload.hidden = values.hidden ? '1' : '0';
			}

			if (values.hasOwnProperty('private')) {
				payload.private = values.private ? '1' : '0';
			}

			async.series([
				async.apply(updatePrivacy, groupName, values.private),
				function(next) {
					if (values.hasOwnProperty('hidden')) {
						updateVisibility(groupName, values.hidden, next);
					} else {
						next();
					}
				},
				async.apply(db.setObject, 'group:' + groupName, payload),
				async.apply(renameGroup, groupName, values.name)
			], function(err) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('action:group.update', {
					name: groupName,
					values: values
				});
				callback();
			});
		});
	};

	function updateVisibility(groupName, hidden, callback) {
		if (hidden) {
			async.parallel([
				async.apply(db.sortedSetRemove, 'groups:visible:createtime', groupName),
				async.apply(db.sortedSetRemove, 'groups:visible:memberCount', groupName),
				async.apply(db.sortedSetRemove, 'groups:visible:name', groupName.toLowerCase() + ':' + groupName),
			], callback);
		} else {
			db.getObjectFields('group:' + groupName, ['createtime', 'memberCount'], function(err, groupData) {
				if (err) {
					return callback(err);
				}
				async.parallel([
					async.apply(db.sortedSetAdd, 'groups:visible:createtime', groupData.createtime, groupName),
					async.apply(db.sortedSetAdd, 'groups:visible:memberCount', groupData.memberCount, groupName),
					async.apply(db.sortedSetAdd, 'groups:visible:name', 0, groupName.toLowerCase() + ':' + groupName),
				], callback);
			});
		}
	}

	Groups.hide = function(groupName, callback) {
		showHide(groupName, 'hidden', callback);
	};

	Groups.show = function(groupName, callback) {
		showHide(groupName, 'show', callback);
	};

	function showHide(groupName, hidden, callback) {
		hidden = hidden === 'hidden';
		callback = callback || function() {};
		async.parallel([
			async.apply(db.setObjectField, 'group:' + groupName, 'hidden', hidden ? 1 : 0),
			async.apply(updateVisibility, groupName, hidden)
		], function(err, results) {
			callback(err);
		});
	}

	Groups.updateCoverPosition = function(groupName, position, callback) {
		Groups.setGroupField(groupName, 'cover:position', position, callback);
	};

	Groups.updateCover = function(data, callback) {
		var tempPath, md5sum, url;

		// Position only? That's fine
		if (!data.imageData && data.position) {
			return Groups.updateCoverPosition(data.groupName, data.position, callback);
		}

		async.series([
			function(next) {
				if (data.file) {
					return next();
				}

				// Calculate md5sum of image
				// This is required because user data can be private
				md5sum = crypto.createHash('md5');
				md5sum.update(data.imageData);
				md5sum = md5sum.digest('hex');
				next();
			},
			function(next) {
				if (data.file) {
					return next();
				}

				// Save image
				tempPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), md5sum);
				var buffer = new Buffer(data.imageData.slice(data.imageData.indexOf('base64') + 7), 'base64');

				fs.writeFile(tempPath, buffer, {
					encoding: 'base64'
				}, next);
			},
			function(next) {
				uploadsController.uploadGroupCover({
					name: 'groupCover',
					path: data.file ? data.file : tempPath
				}, function(err, uploadData) {
					if (err) {
						return next(err);
					}

					url = uploadData.url;
					next();
				});
			},
			function(next) {
				Groups.setGroupField(data.groupName, 'cover:url', url, next);
			},
			function(next) {
				fs.unlink(data.file ? data.file : tempPath, next);	// Delete temporary file
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			if (data.position) {
				Groups.updateCoverPosition(data.groupName, data.position, function(err) {
					callback(err, {url: url});
				});
			} else {
				callback(err, {url: url});
			}
		});
	};

	function updatePrivacy(groupName, newValue, callback) {
		if (!newValue) {
			return callback();
		}

		Groups.getGroupFields(groupName, ['private'], function(err, currentValue) {
			if (err) {
				return callback(err);
			}
			currentValue = currentValue.private === '1';

			if (currentValue !== newValue && currentValue === true) {
				// Group is now public, so all pending users are automatically considered members
				db.getSetMembers('group:' + groupName + ':pending', function(err, uids) {
					if (err) { return callback(err); }
					else if (!uids) { return callback(); }	// No pending users, we're good to go

					var now = Date.now(),
						scores = uids.map(function() { return now; });	// There's probably a better way to initialise an Array of size x with the same value...

					winston.verbose('[groups.update] Group is now public, automatically adding ' + uids.length + ' new members, who were pending prior.');
					async.series([
						async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', scores, uids),
						async.apply(db.delete, 'group:' + groupName + ':pending')
					], callback);
				});
			} else {
				callback();
			}
		});
	}

	function renameGroup(oldName, newName, callback) {
		if (oldName === newName || !newName || newName.length === 0) {
			return callback();
		}

		db.getObject('group:' + oldName, function(err, group) {
			if (err || !group) {
				return callback(err);
			}

			if (parseInt(group.system, 10) === 1 || parseInt(group.hidden, 10) === 1) {
				return callback();
			}

			Groups.exists(newName, function(err, exists) {
				if (err || exists) {
					return callback(err || new Error('[[error:group-already-exists]]'));
				}

				async.series([
					async.apply(db.setObjectField, 'group:' + oldName, 'name', newName),
					async.apply(db.setObjectField, 'group:' + oldName, 'slug', utils.slugify(newName)),
					async.apply(db.deleteObjectField, 'groupslug:groupname', group.slug),
					async.apply(db.setObjectField, 'groupslug:groupname', utils.slugify(newName), newName),
					function(next) {
						db.getSortedSetRange('groups:createtime', 0, -1, function(err, groups) {
							if (err) {
								return next(err);
							}
							async.each(groups, function(group, next) {
								renameGroupMember('group:' + group + ':members', oldName, newName, next);
							}, next);
						});
					},
					async.apply(db.rename, 'group:' + oldName, 'group:' + newName),
					async.apply(db.rename, 'group:' + oldName + ':members', 'group:' + newName + ':members'),
					async.apply(db.rename, 'group:' + oldName + ':owners', 'group:' + newName + ':owners'),
					async.apply(db.rename, 'group:' + oldName + ':pending', 'group:' + newName + ':pending'),
					async.apply(db.rename, 'group:' + oldName + ':invited', 'group:' + newName + ':invited'),

					async.apply(renameGroupMember, 'groups:createtime', oldName, newName),
					async.apply(renameGroupMember, 'groups:visible:createtime', oldName, newName),
					async.apply(renameGroupMember, 'groups:visible:memberCount', oldName, newName),
					async.apply(renameGroupMember, 'groups:visible:name', oldName.toLowerCase() + ':' + oldName, newName.toLowerCase() + ':' + newName),
					function(next) {
						plugins.fireHook('action:group.rename', {
							old: oldName,
							new: newName
						});

						next();
					}
				], callback);
			});
		});
	}

	function renameGroupMember(group, oldName, newName, callback) {
		db.isSortedSetMember(group, oldName, function(err, isMember) {
			if (err || !isMember) {
				return callback(err);
			}
			var score;
			async.waterfall([
				function (next) {
					db.sortedSetScore(group, oldName, next);
				},
				function (_score, next) {
					score = _score;
					db.sortedSetRemove(group, oldName, next);
				},
				function (next) {
					db.sortedSetAdd(group, score, newName, next);
				}
			], callback);
		});
	}
};
