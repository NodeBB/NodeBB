<div component="chat/room/teaser">
	{{{ if ./teaser }}}
	<div class="teaser-content text-sm line-clamp-3 text-break">
		{buildAvatar(./teaser.user, "14px", true, "align-middle")}
		<strong class="text-xs fw-semibold teaser-username">{./teaser.user.displayname}:</strong>
		{./teaser.content}
	</div>
	<div class="teaser-timestamp text-muted text-xs">{{{ if ./teaser.timeagoLong }}}{./teaser.timeagoLong}{{{ else }}}<span class="timeago" title="{./teaser.timestampISO}"></span>{{{ end }}}</div>
	{{{ end }}}
</div>