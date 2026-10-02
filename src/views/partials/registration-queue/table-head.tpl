<thead>
	<tr>
		<th class="align-middle" style="width: 1px;">
			<input class="form-check-input border-secondary" component="registration-queue/select/all" type="checkbox" aria-label="{{tx("registration-queue:select-all")}}"/>
		</th>
		<th>{{tx("registration-queue:list.name")}}</th>
		<th>{{tx("registration-queue:list.email")}}</th>
		<th class="hidden-xs">{{tx("registration-queue:list.ip")}}</th>
		<th class="hidden-xs">{{tx("registration-queue:list.time")}}</th>
		{{{ each customHeaders }}}
		<th class="hidden-xs">{{tx(./label)}}</th>
		{{{ end }}}
		<th></th>
	</tr>
</thead>
