<h2>[[notifications:title]]</h2>

<button type="button" class="btn btn-default">Mark All as Read</button>

<ul class="notifications-list">
<!-- BEGIN notifications -->
	<li data-nid="{notifications.nid}">
		<p class="timestamp">
			<span class="timeago" title="{notifications.datetimeISO}"></span>
		</p>
		<a href="..{notifications.path}">{notifications.text}</a>
	</li>
<!-- END notifications -->
</ul>