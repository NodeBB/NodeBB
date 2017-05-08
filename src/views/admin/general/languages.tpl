<div class="languages">
	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">[[admin/general/languages:language-settings]]</div>
		<div class="col-sm-10 col-xs-12">
			<p>
				[[admin/general/languages:description]]
			</p>

			<form class="row">
				<div class="form-group col-sm-6">
					<label for="defaultLang">[[admin/general/languages:default-language]]</label>
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
							<span class="mdl-switch__label">[[admin/general/languages:auto-detect]]</span>
						</label>
					</div>
				</div>
			</form>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>