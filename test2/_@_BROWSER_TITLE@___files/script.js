function goBack() {
    window.history.back();
}
//document.getElementById('backBtn').addEventListener('click', goBack);

var input = document.getElementById("phone");
      window.intlTelInput(input, {
        separateDialCode: false,
        // allowDropdown: false,
        // autoInsertDialCode: true,
        // autoPlaceholder: "off",
        dropdownContainer: document.body,
        // excludeCountries: ["us"],
        // formatOnDisplay: false,
        // geoIpLookup: function(callback) {
        //   fetch("https://ipapi.co/json")
        //     .then(function(res) { return res.json(); })
        //     .then(function(data) { callback(data.country_code); })
        //     .catch(function() { callback("us"); });
        // },
        // hiddenInput: "full_number",
        // initialCountry: "auto",
        // localizedCountries: { 'de': 'Deutschland' },
        // nationalMode: false,
        // onlyCountries: ['us', 'gb', 'ch', 'ca', 'do'],
        placeholderNumberType: "MOBILE",
        // preferredCountries: ['cn', 'jp'],
        // separateDialCode: true,
        // showFlags: false,
        // useFullscreenPopup: true,
        utilsScript: "js/utils.js"
    });