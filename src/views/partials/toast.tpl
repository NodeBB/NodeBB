<div id="{alert_id}" role="alert" class="alert alert-dismissible alert-{type} fade show" component="toaster/toast">
	<div class="alert-progress position-absolute top-0 start-0 bottom-0 h-100 z-0" style=" opacity:0.1;"></div>
	<div component="toast/body" class="d-flex flex-wrap gap-2 position-relative">
		{{{ if image }}}
		<img component="toast/image" src="{image}" height="80" style="width: auto;" />
		{{{ end }}}
		<div class="d-flex flex-column gap-2">
			{{{ if title }}}
			<strong component="toast/title">{{tx(title)}}</strong>
			{{{ end }}}

			{{{ if message }}}
			<p class="m-0" component="toast/message">{{tx(message)}}</p>
			{{{ end }}}
		</div>
	</div>

	<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="close"></button>
</div>
