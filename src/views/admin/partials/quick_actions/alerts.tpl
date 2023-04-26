<div class="alert {{{ if upgradeAvailable }}}alert-warning{{{ else }}}alert-info{{{ end }}}">
	<span>[[admin/menu:alerts.version, {version}]]</span>
	{{{ if upgradeAvailable }}}
	<span style="margin-left: 10px">
		<a href="https://docs.nodebb.org/configuring/upgrade/" target="_blank">
			<u>[[admin/menu:alerts.upgrade, {latestVersion}]]</u>
		</a>
	</span>
	{{{ end }}}
</div>