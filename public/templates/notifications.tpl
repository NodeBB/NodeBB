<h2>[[notifications:title]]</h2>

<button type="button" class="btn btn-default" id="mark-all-notifs-read">[[notifications:mark_all_as_read]]</button>

<ul class="notifications-list">
<!-- BEGIN notifications -->
	<li data-nid="{notifications.nid}" class="{notifications.readClass}">
		<a href="{notifications.path}">{notifications.text}</a>
		<p class="timestamp">
			<span class="timeago" title="{notifications.datetimeISO}"></span>
		</p>
	</li>
<!-- END notifications -->
</ul>
