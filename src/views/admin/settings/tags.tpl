<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Tag Settings</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="publicTagListing"> Make the tags list publically viewable
				</label>
			</div>
			<div class="form-group">
				<label for="tagsPerTopics">Tags per Topic</label>
				<input id="tagsPerTopics" type="text" class="form-control" value="5" data-field="tagsPerTopic">
			</div>
			<div class="form-group">
				<label for="minimumTagLength">Minimum Tag Length</label>
				<input id="minimumTagLength" type="text" class="form-control" value="3" data-field="minimumTagLength">
			</div>
			<div class="form-group">
				<label for="maximumTagLength">Maximum Tag Length</label>
				<input id="maximumTagLength" type="text" class="form-control" value="15" data-field="maximumTagLength">
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->