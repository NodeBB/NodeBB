<div id="rewards">
	<div class="col-lg-9">
		<div class="card">
			<div class="card-header">Rewards</div>
			<div class="card-block">
				<ul id="active">
					<!-- BEGIN active -->
					<li data-rid="{active.rid}" data-id="{active.id}">
						<form class="main inline-block">
							<div class="card inline-block">
								<label for="condition">If User's</label><br />
								<select name="condition" data-selected="{active.condition}">
									<!-- BEGIN conditions -->
									<option value="{conditions.condition}">{conditions.name}</option>
									<!-- END conditions -->
								</select>
							</div>
							<div class="card inline-block">
								<label for="condition">Is:</label><br />
								<select name="conditional" data-selected="{active.conditional}">
									<!-- BEGIN conditionals -->
									<option value="{conditionals.conditional}">{conditionals.name}</option>
									<!-- END conditionals -->
								</select>
								<input type="text" name="value" value="{active.value}" />
							</div>
							<div class="card inline-block">
								<label for="condition">Then:</label><br />
								<select name="rid" data-selected="{active.rid}">
									<!-- BEGIN rewards -->
									<option value="{rewards.rid}">{rewards.name}</option>
									<!-- END rewards -->
								</select>
							</div>
						</form>

						<form class="rewards inline-block">
							<div class="inputs card inline-block"></div>
						</form>
						<div class="clearfix"></div>

						<div class="pull-xs-right">
							<div class="card-block inline-block">
								<form class="main">
									<label for="claimable">Amount of times reward is claimable</label><br />
									<input type="text" name="claimable" value="{active.claimable}" placeholder="1" />
									<small>Enter 0 for infinite</small>
								</form>
							</div>
							<div class="card-block inline-block">
								<button class="btn btn-danger delete">Delete</button>
								<!-- IF active.disabled -->
								<button class="btn btn-success toggle">Enable</button>
								<!-- ELSE -->
								<button class="btn btn-warning toggle">Disable</button>
								<!-- ENDIF active.disabled -->
							</div>
						</div>
						<div class="clearfix"></div>
					</li>
					<!-- END active -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="card">
			<div class="card-header">Rewards Control</div>
			<div class="card-block">
				<button class="btn btn-success btn-md" id="new">New Reward</button>
				<button class="btn btn-primary btn-md" id="save">Save Changes</button>
			</div>
		</div>
	</div>
</div>