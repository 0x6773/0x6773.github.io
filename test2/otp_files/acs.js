antjq(document).ready(function () {
    // Do not show current langauge in language selector
    antjq('.dropdown-content a').each(function () {
        if (antjq(this).data('lang-label') == antjq('#language-selector button').text()) {
            antjq(this).remove();
        }
    });
});
