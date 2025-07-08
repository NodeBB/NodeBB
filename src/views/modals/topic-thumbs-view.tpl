<div class="d-flex flex-column gap-4 topic-thumbs-view-modal">
	<div class="d-flex justify-content-center align-items-center mb-5" style="height: 33vh; max-height: 33vh;">
		<img component="topic/thumb/current" class="rounded" src="{src}" style="max-height: 33vh; max-width:100%;" />
	</div>
	{{{ if (thumbs.length != "1") }}}
	<hr/>
	<div class="d-flex justify-content-center mb-3 gap-3 flex-wrap">
	{{{ each thumbs }}}
		<a href="#" component="topic/thumb/select" class="p-1 rounded-3 border border-3 {{{ if ./selected }}}border-primary{{{ end }}}">
			<img class="rounded-2" height="64px" style="width: auto;" src="{./url}"/>
		</a>
	{{{ end }}}
	</div>
	{{{ end }}}
</div>