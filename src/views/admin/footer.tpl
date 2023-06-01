		</div> <!-- #content end-->
	</div>

	<!-- IMPORT admin/partials/mobile-footer.tpl -->
	{{{ if !isSpider }}}
	<div class="">
		<div component="toaster/tray" class="alert-window fixed-bottom mb-5 mb-md-2 me-2 me-md-5 ms-auto" style="width:300px; z-index: 1090;">
			<div id="reconnect-alert" class="alert alert-dismissible alert-warning clearfix hide" component="toaster/toast">
				<button type="button" class="btn-close float-end" data-bs-dismiss="alert" aria-hidden="true"></button>
				<p>[[global:reconnecting-message, {config.siteTitle}]]</p>
			</div>
		</div>
	</div>
	{{{ end }}}
	<script>
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', prepareFooter);
		} else {
			prepareFooter();
		}

		function prepareFooter() {
			$(document).ready(function () {
				app.coldLoad();
			});
		}
	</script>
</body>
</html>
