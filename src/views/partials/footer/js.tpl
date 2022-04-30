<script defer src="{relative_path}/assets/nodebb.min.js?{config.cache-buster}"></script>

{{{each scripts}}}
<script defer type="text/javascript" src="{scripts.src}"></script>
{{{end}}}

<script>
    document.documentElement.style.setProperty('--panel-offset', `${localStorage.getItem('panelOffset') || 0}px`);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', prepareFooter);
    } else {
        prepareFooter();
    }

    function prepareFooter() {
        <!-- IF useCustomJS -->
        {{customJS}}
        <!-- ENDIF useCustomJS -->

        $(document).ready(function () {
            app.coldLoad();
        });
    }
</script>