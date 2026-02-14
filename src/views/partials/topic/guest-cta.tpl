<div id="guest-cta-alert" class="alert alert-warning alert-dismissible fade show guest-cta-alert" role="alert">
	<p><strong>[[topic:guest-cta.title]]</strong></p>
	<p>[[topic:guest-cta.message]]</p>
	<p>[[topic:guest-cta.closing]]</p>
	<a href="{config.relative_path}/register" class="fw-semibold btn btn-sm btn-warning">[[global:register]]</a>
	<a href="{config.relative_path}/login" class="fw-semibold btn btn-sm btn-info">[[global:login]]</a>
	<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>
<script>
(() => {
	const alertEl = document.getElementById('guest-cta-alert');
	if (alertEl) {
		if (sessionStorage.getItem('guestAlertDismissed')) {
			alertEl.remove();
			return;
		}
		alertEl.addEventListener('close.bs.alert', function () {
			sessionStorage.setItem('guestAlertDismissed', 'true');
		});
	}
})();
</script>