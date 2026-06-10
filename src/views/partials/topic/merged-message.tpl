<div component="topic/merged/message" class="alert alert-info d-flex justify-content-between flex-wrap">
	<span>{tx("topic:merged-message", mergedIntoHref, merger.mergedIntoTitle)}</span>
	<span>
		<a class="fw-bold" href="{config.relative_path}/user/{merger.userslug}">{merger.username}</strong></a> <small class="timeago" title="{mergedTimestampISO}"></small>
	</span>
</div>