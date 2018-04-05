<div class="alert <!-- IF upgradeAvailable -->alert-warning<!-- ELSE -->alert-info<!-- END --> well-sm">
	<span>[[admin/menu:alerts.version, {version}]]</span>
	<!-- IF upgradeAvailable -->
	<span style="margin-left: 10px">
		<a href="https://docs.nodebb.org/configuring/upgrade/" target="_blank">
			<u>[[admin/menu:alerts.upgrade, {latestVersion}]]</u>
		</a>
	</span>
	<!-- END -->
</div>