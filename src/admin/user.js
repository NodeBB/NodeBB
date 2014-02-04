var utils = require('../../public/src/utils'),
	user = require('../user'),
	groups = require('../groups');

(function(UserAdmin) {

	UserAdmin.createUser = function(uid, userData, callback) {
		user.isAdministrator(uid, function(err, isAdmin) {
			if(err) {
				return callback(err);
			}

			if (isAdmin) {
				user.create(userData, function(err) {
					if(err) {
						return callback(err);
					}

					callback(null);
				});
			} else {
				callback(new Error('You are not an administrator'));
			}
		});
	}

	UserAdmin.makeAdmin = function(uid, theirid, socket) {
		user.isAdministrator(uid, function(err, isAdmin) {
			if (isAdmin) {
				groups.getGidFromName('administrators', function(err, gid) {
					groups.join(gid, theirid, function(err) {
						if (!err) {
							socket.emit('event:alert', {
								title: 'User Modified',
								message: 'This user is now an administrator!',
								type: 'success',
								timeout: 2000
							});
						}
					});
				});
			} else {
				socket.emit('event:alert', {
					title: 'Warning',
					message: 'You need to be an administrator to make someone else an administrator!',
					type: 'warning',
					timeout: 2000
				});
			}
		});
	};

	UserAdmin.removeAdmin = function(uid, theirid, socket) {
		user.isAdministrator(uid, function(err, isAdmin) {
			if (isAdmin) {
				groups.getGidFromName('administrators', function(err, gid) {
					groups.leave(gid, theirid, function(err) {
						if (!err) {

							socket.emit('event:alert', {
								title: 'User Modified',
								message: 'This user is no longer an administrator!',
								type: 'success',
								timeout: 2000
							});
						}
					});
				});
			}
		});
	};

	UserAdmin.banUser = function(uid, theirid, socket, callback) {
		user.isAdministrator(uid, function(err, amIAdmin) {
			user.isAdministrator(theirid, function(err, areTheyAdmin) {
				if (amIAdmin && !areTheyAdmin) {
					user.ban(theirid, function(err, result) {
						callback(true);
						socket.emit('event:alert', {
							alert_id: 'ban_user',
							title: 'User Banned',
							message: 'This user is banned!',
							type: 'success',
							timeout: 2000
						});
					});
				}
			});
		});
	};

	UserAdmin.unbanUser = function(uid, theirid, socket) {
		user.isAdministrator(uid, function(err, amIAdmin) {
			if (amIAdmin) {
				user.unban(theirid, function(err, result) {
					socket.emit('event:alert', {
						alert_id: 'ban_user',
						title: 'User Unbanned',
						message: 'This user is unbanned!',
						type: 'success',
						timeout: 2000
					});
				});
			}
		});
	};

}(exports));