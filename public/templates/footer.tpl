

	</div><!--END container -->
	<!-- START Forum Info -->
	<div id="footer" class="container hidden-phone" style="padding-top: 50px; display: none">
		<div class="alert alert-info">
			<span id="active_users"></span>; <span id="active_record"></span><br />
			<span id="number_of_users"></span><br />
			<span id="latest_user"></span>
		</div>
		<footer class="footer">Copyright &copy; 2013 <a target="_blank" href="http://www.nodebb.com">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

	<script type="text/javascript">
	(function() {
		var num_users = document.getElementById('number_of_users'),
			latest_user = document.getElementById('latest_user'),
			active_users = document.getElementById('active_users'),
			user_label = document.getElementById('user_label'),
			active_record = document.getElementById('active_record'),
			right_menu = document.getElementById('right-menu');

		socket.emit('user.count', {});
		socket.on('user.count', function(data) {
			num_users.innerHTML = "We currently have <b>" + data.count + "</b> registered users.";
		});
		socket.emit('user.latest', {});
		socket.on('user.latest', function(data) {
			if (data.username == '') {
				latest_user.innerHTML = '';
			} else {
				latest_user.innerHTML = "The most recent user to register is <b><a href='/users/"+data.username+"'>" + data.username + "</a></b>.";
			}
		});
		socket.emit('api:user.active.get');
		socket.on('api:user.active.get', function(data) {
			var plural_users = parseInt(data.users) !== 1,
				plural_anon = parseInt(data.anon) !== 1;

			active_users.innerHTML = 'There ' + (plural_users ? 'are' : 'is') + ' <strong>' + data.users + '</strong> user' + (plural_users ? 's' : '') + ' and <strong>' + data.anon + '</strong> guest' + (plural_anon ? 's' : '') + ' online';
		});
		socket.emit('api:user.active.get_record');
		socket.on('api:user.active.get_record', function(data) {
			active_record.innerHTML = "most users ever online was <strong>" + data.record + "</strong> on <strong>" + (new Date(parseInt(data.timestamp,10))).toUTCString() + "</strong>";
		});

		socket.emit('api:updateHeader', { fields: ['username', 'picture'] });

		socket.on('api:updateHeader', function(data) {
			var rightMenu = $('#right-menu');
			if (data.uid > 0) {
				var userLabel = rightMenu.find('#user_label');
				userLabel.attr('href','/users/'+data['username']);

				userLabel.find('img').attr('src',data['picture']+"?s=24");
				userLabel.find('span').html(data['username']);
				
			} else {
				
				rightMenu.html('');

				var registerEl = document.createElement('li'),
					loginEl = document.createElement('li');

				registerEl.innerHTML = '<a href="/register">Register</a>';
				loginEl.innerHTML = '<a href="/login">Login</a>';

				right_menu.appendChild(registerEl);
				right_menu.appendChild(loginEl);
			}
		});

		// Post window events
		var	postWindowEl = document.getElementById('post_window'),
			discardEl = document.getElementById('discard-post');
		discardEl.addEventListener('click', function() {
			$(postWindowEl).slideToggle(250);
			$(document.body).removeClass('composing');
		}, false);

		// Notifications dropdown
		var notifContainer = document.getElementsByClassName('notifications')[0],
			notifTrigger = notifContainer.querySelector('a'),
			notifList = document.getElementById('notif-list');
		notifTrigger.addEventListener('click', function() {
			if (notifContainer.className.indexOf('open') === -1) socket.emit('api:notifications.get');
		});
		notifList.addEventListener('click', function(e) {
			var target;
			switch(e.target.nodeName) {
				case 'SPAN': target = e.target.parentNode.parentNode; break;
				case 'A': target = e.target.parentNode; break;
				case 'li': target = e.target; break;
			}
			if (target) {
				var nid = parseInt(target.getAttribute('data-nid'));
				if (nid > 0) socket.emit('api:notifications.mark_read', nid);
			}
		})
		socket.on('api:notifications.get', function(data) {
			console.log(data);
			var	notifFrag = document.createDocumentFragment(),
				notifEl = document.createElement('li'),
				numRead = data.read.length,
				numUnread = data.unread.length,
				x;
			notifList.innerHTML = '';
			if (data.read.length + data.unread.length > 0) {
				for(x=0;x<numUnread;x++) {
					notifEl.setAttribute('data-nid', data.unread[x].nid);
					notifEl.className = 'unread';
					notifEl.innerHTML = '<a href="' + data.unread[x].path + '"><span class="pull-right">' + utils.relativeTime(data.unread[x].datetime, true) + '</span>' + data.unread[x].text + '</a>';
					notifFrag.appendChild(notifEl.cloneNode(true));
				}
				for(x=0;x<numRead;x++) {
					notifEl.setAttribute('data-nid', data.read[x].nid);
					notifEl.className = '';
					notifEl.innerHTML = '<a href="' + data.read[x].path + '"><span class="pull-right">' + utils.relativeTime(data.read[x].datetime, true) + '</span>' + data.read[x].text + '</a>';
					notifFrag.appendChild(notifEl.cloneNode(true));
				}
			} else {
				notifEl.innerHTML = '<a>You have no notifications</a>';
				notifFrag.appendChild(notifEl);
			}
			notifList.appendChild(notifFrag);
		});
		socket.on('api:notifications.counts', function(counts) {
			var notifIcon = document.querySelector('.notifications a i');
			if (counts.unread > 0) notifIcon.className = 'icon-circle active';
			else notifIcon.className = 'icon-circle-blank';
		});
		socket.emit('api:notifications.counts');
	}());
	</script>
	<!-- END Forum Info -->
</body>
</html>