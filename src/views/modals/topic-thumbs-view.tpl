<div class="d-flex flex-column gap-4 topic-thumbs-view-modal">
	<div class="d-flex justify-content-center align-items-center mb-5" style="height: 33vh; max-height: 33vh;">
		<img component="topic/thumb/current" src="{src}" style="max-height: 33vh; max-width:100%;" />
	</div>
	{{{ if (thumbs.length != "1") }}}
	<hr/>
	<div class="d-flex justify-content-center mb-3 gap-3">
	{{{ each thumbs }}}
		<div>
			<img component="topic/thumb/select" class="pointer rounded p-1 border border-3 {{{ if ./selected }}}border-primary{{{ end }}}" height="64px" style="width: auto;" src="{./url}"/>
		</div>
	{{{ end }}}
	</div>
	{{{ end }}}
</div>