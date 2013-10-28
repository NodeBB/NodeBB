var RDB = require('../redis'),
	utils = require('../../public/src/utils'),
	user = require('../user'),
	Groups = require('../groups');

(function(UserAdmin) {

	UserAdmin.makeAdmin = function(uid, theirid, socket) {
		user.isAdministrator(uid, function(isAdmin) {
			if (isAdmin) {
				Groups.getGidFromName('Administrators', function(err, gid) {
					Groups.join(gid, theirid, function(err) {
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
		user.isAdministrator(uid, function(isAdmin) {
			if (isAdmin) {
				Groups.getGidFromName('Administrators', function(err, gid) {
					Groups.leave(gid, theirid, function(err) {
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
		user.isAdministrator(uid, function(amIAdmin) {
			user.isAdministrator(theirid, function(areTheyAdmin) {
				if (amIAdmin && !areTheyAdmin) {
					user.ban(theirid, function(err, result) {
						callback(true);
						socket.emit('event:alert', {
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
		user.isAdministrator(uid, function(amIAdmin) {
			if (amIAdmin) {
				user.unban(theirid, function(err, result) {
					socket.emit('event:alert', {
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