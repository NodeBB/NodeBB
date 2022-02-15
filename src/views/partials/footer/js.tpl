<script defer src="{relative_path}/dist/app.bundle.js?{config.cache-buster}"></script>

{{{each scripts}}}
<script defer type="text/javascript" src="{scripts.src}"></script>
{{{end}}}

<script>
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