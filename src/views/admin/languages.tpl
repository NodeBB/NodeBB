
<div class="languages">
	<h1><i class="fa fa-language"></i> Languages</h1>
	<hr />
	<p>
		The following setting(s) determine the language settings for your NodeBB.
		The default language determines the language settings for all users who
		are visiting your NodeBB. <!-- Keep in mind that individual users may decide
		to switch languages for their own accounts. -->
	</p>

	<form class="row">
		<div class="form-group col-sm-6">
			<label for="defaultLang">Default Language</label>
			<select id="language" data-field="defaultLang" class="form-control">
				<!-- BEGIN languages -->
				<option value="{languages.code}">{languages.name} ({languages.code})</option>
				<!-- END languages -->
			</select>
		</div>
	</form>
</div>

<button class="btn btn-primary" id="save">Save</button>
<script type="text/javascript">
$('#language').val(translator.getLanguage());
</script>