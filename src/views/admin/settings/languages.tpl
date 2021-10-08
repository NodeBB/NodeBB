<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/languages:language-settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<p>
			[[admin/settings/languages:description]]
		</p>

		<form class="row">
			<div class="form-group col-sm-6">
				<label for="language">[[admin/settings/languages:default-language]]</label>
				<select id="language" data-field="defaultLang" class="form-control">
					<!-- BEGIN languages -->
					<option value="{languages.code}" <!-- IF languages.selected -->selected<!-- ENDIF languages.selected -->>{languages.name} ({languages.code})</option>
					<!-- END languages -->
				</select>
			</div>
		</form>

		<form class="row">
			<div class="form-group col-sm-6">
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input class="mdl-switch__input" type="checkbox" data-field="autoDetectLang" <!-- IF autoDetectLang -->checked<!-- ENDIF autoDetectLang -->/>
						<span class="mdl-switch__label">[[admin/settings/languages:auto-detect]]</span>
					</label>
				</div>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->