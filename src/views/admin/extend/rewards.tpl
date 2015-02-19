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
							<select name="condition">
								<!-- BEGIN conditions -->
								<option value="{conditions.condition}" data-selected="{active.condition}">{conditions.name}</option>
								<!-- END conditions -->
							</select>
							Is
							<select name="conditional" data-selected="{active.conditional}">
								<!-- BEGIN conditionals -->
								<option value="{conditionals.conditional}">{conditionals.name}</option>
								<!-- END conditionals -->
							</select>
							<input type="text" value="{active.value}" />
							Then
							<select name="reward" data-selected="{active.rewardID}">
								<!-- BEGIN rewards -->
								<option value="{rewards.rewardID}">{rewards.name}</option>
								<!-- END rewards -->
							</select>
						</li>
						<!-- END active -->
					</ul>
				</form>
				<input type="hidden" id="rewards" value="{function.stringify, rewards}" />
				<input type="hidden" id="active" value="{function.stringify, active}" />
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