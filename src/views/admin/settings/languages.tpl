<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/languages:language-settings]]</div>
	<div class="col-sm-10 col-12">
		<p>
			[[admin/settings/languages:description]]
		</p>

		<form class="row mb-4">
			<div class="form-group col-sm-6">
				<label class="form-label" for="language">[[admin/settings/languages:default-language]]</label>
				<select id="language" data-field="defaultLang" class="form-select">
					<!-- BEGIN languages -->
					<option value="{languages.code}" <!-- IF languages.selected -->selected<!-- ENDIF languages.selected -->>{languages.name} ({languages.code})</option>
					<!-- END languages -->
				</select>
			</div>
		</form>

		<form class="row">
			<div class="form-group col-sm-6">
				<div class="formcheck">
					<input class="form-check-input" type="checkbox" data-field="autoDetectLang" <!-- IF autoDetectLang -->checked<!-- ENDIF autoDetectLang -->/>
					<label class="form-check-label">[[admin/settings/languages:auto-detect]]</label>
				</div>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->