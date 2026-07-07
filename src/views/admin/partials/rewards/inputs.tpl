{{{ each inputs }}}
<label class="form-label text-nowrap" for="{./name}">{./label}</label>
{{{ if (./type == "select") }}}
<select class="form-select form-select-sm" name="{./name}" >
	{{{ each ./values }}}
	<option value="{./value}">{./name}</option>
	{{{ end }}}
</select>
{{{ end }}}

{{{ if (./type == "text") }}}
<input type="text" class="form-control form-control-sm" name="{./name}" />
{{{ end }}}
{{{ end }}}

