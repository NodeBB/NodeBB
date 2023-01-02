<p class="number-of-diffs">
	<!-- IF numDiffs -->
	[[topic:diffs.description, {numDiffs}]]
	<!-- ELSE -->
	[[topic:diffs.no-revisions-description, {numDiffs}]]
	<!-- END -->
</p>
<!-- IF numDiffs -->
<div class="form-group">
	<select class="form-control">
		{{{each diffs}}}
		<option value="{../timestamp}">
			{../pretty}
			{{{ if ../username }}}[{../username}]{{{ end }}}
			<!-- IF @first -->([[topic:diffs.current-revision]])<!-- END -->
			<!-- IF @last -->([[topic:diffs.original-revision]])<!-- END -->
		</option>
		{{{end}}}
	</select>

	<hr />

	<ul class="posts-list diffs"></ul>

	{{{ if editable }}}
	<button class="btn btn-primary" data-action="restore">[[topic:diffs.restore]]</button>
	{{{ end }}}
	{{{ if deletable }}}
	<button class="btn btn-danger" data-action="delete">[[topic:diffs.delete]]</button>
	{{{ end }}}
	{{{ if editable }}}
	<p class="help-block">[[topic:diffs.restore-description]]</p>
	{{{ end }}}

</div>
<!-- END -->
