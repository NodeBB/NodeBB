<div id="rewards">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">Rewards</div>
			<div class="panel-body">
				<form>
					<ul>
						<!-- BEGIN active -->
						<li>
							If User's
							<select name="condition" class="form-control">
								<!-- BEGIN conditions -->
								<option value="{conditions.condition}">{conditions.name}</option>
								<!-- END conditions -->
							</select>
							Is
							<select name="conditional" class="form-control">
								<!-- BEGIN conditionals -->
								<option value="{conditionals.conditional}">{conditionals.name}</option>
								<!-- END conditionals -->
							</select>
							<input type="text" class="form-control" value="{active.conditional.value}" />
						</li>
						<!-- END active -->
					</ul>
				</form>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Save Settings</div>
			<div class="panel-body">
				<button class="btn btn-primary btn-md" id="save">Save Changes</button>
			</div>
		</div>
	</div>
</div>