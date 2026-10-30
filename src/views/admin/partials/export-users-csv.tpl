<div>
	{{{ each options }}}
	<div class="form-check mb-2">
		<input data-field="{./field}" class="form-check-input" type="checkbox" id="option-{@index}" {{{ if ./selected }}}checked{{{ end }}}>
		<label class="form-check-label" for="option-{@index}">
			{{tx(./label)}}
		</label>
	</div>
	{{{ end }}}
</div>