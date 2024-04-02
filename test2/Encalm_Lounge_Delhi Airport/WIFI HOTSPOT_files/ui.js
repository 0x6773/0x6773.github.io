let projectJsonData = null;
let rating_version = null;
let page_name = null;
let button_disable_obj = null;
let btn_enable_obj = null;

let current_page = window.location.href;

if(current_page.includes("signin.html")) {
	page_name = "signin";
}
else if(current_page.includes("status.html")) {
	page_name = "status";
}

function pageLoadErrorHandling() {
	let ele = document.querySelector(".login-page-error-msg");
	let main_content = document.querySelector(".container");
	main_content.style.display = "none"; 
	if(ele != null) {
		ele.innerHTML = `
			<div class="browser-not-support">
				<div class="mdc-card card">
					<div class="mdc-card__media card-media">
						<img src="assets/images/undraw_warning.svg" loading="lazy" width="100%" height="auto" alt="Warning image">
					</div>
					<div class="card-content" style="margin:16px 0px">				
						Something went wrong, Getting project !!
					</div>
				</div>
			</div>
		`;
	}
	else {
		alert("Something went wrong, getting project !!!");
	}
}

const buttons = document.querySelectorAll('.mdc-button');
for (const button of buttons) {
  mdc.ripple.MDCRipple.attachTo(button);
}

// This function is for the open signin page
function openSignin() {
	buttonDisable("loginButton", button_disable_obj);
	linerProressBar("loginBtnProgress", true);
	window.location.href = 'signin.html';
	setTimeout(()=>{
		buttonEnable('loginButton', 'primary', btn_enable_obj );
		linerProressBar('loginBtnProgress', false);
	}, 2000);
}
 
// This function is for the open faq page
function openFaqPage(){
	window.location.href = "faq.html";
}

// This function is for the open signin page
function backToLoginPage(){
	window.location.href="signin.html";
}

//This function use for the proper working of lable in the input-field
function floatingLabel() {
	document.querySelectorAll('.mdc-text-field').forEach(function (element) {
		mdc.textField.MDCTextField.attachTo(element);
	});
}

//This function is for the show and hide password in input-field
function passwordVisibility() {
	let Visibility = document.querySelector(".mdc-text-field__icon--trailing");
	let P_visibility = document.querySelector(".P_visibility");
  
	if(Visibility.innerHTML === "visibility_off"){
		P_visibility.type = "password";
	  	Visibility.innerHTML = "visibility";
	}
	else if(Visibility.innerHTML === "visibility") {
		P_visibility.type = "text";
	  	Visibility.innerHTML = "visibility_off";
	}
}

//This function is for the enable RESEND OTP button after 120 seconds
let stop_count = false;
function stopCount() {
	stop_count = true;
}
function startCount(otp_status = "registerStatus", ) {
	let seconds = 120;
	let timeout;
	let timer_on = true;
	if (timer_on == true) {
		buttonDisable("generate", button_disable_obj);
		function timedCount() {
			seconds--;
			let otp_button_label = document.querySelector(".generate-btn-label");
			otp_button_label.innerText = "Resend OTP in " + (seconds < 10 ? "0" : "") + seconds + " seconds";
			timeout = setTimeout(timedCount, 1000);
			if(Math.sign(seconds) == -1) {
				buttonEnable("generate","secondary", btn_enable_obj)
				otp_button_label.innerText = "RESEND OTP";
				document.querySelector("."+otp_status).innerHTML = "";	
				clearTimeout(timeout);
				timer_on = false;
				seconds = 120;
			}
			if(stop_count == true && timeout != undefined) {
				clearTimeout(timeout);
				timer_on = false;
			}
		}
		if(stop_count == true) {
			clearTimeout(timeout);
			timer_on = false;
		}
		else if(stop_count == false){
			timedCount();
		}
	}
}

/* 
	This function is for show mikrotik error message
	This function is for configure error type on enter or focus out
*/
function loadSignin() {	
	floatingLabel();
	
	// below code for showing error messages 
	const url = new URL(window.location.href);
	if(url.searchParams.has("error")){
		let otp_container = document.querySelectorAll(".after-otp-section");
		if(otp_container != null){
			for(let i = 0; i < otp_container.length; i++) {
				otp_container[i].style.display = "block";
			};
		}
		var error_msg = url.searchParams.get("error");
		document.querySelector(".mobile-api-response").innerHTML = error_msg;
		document.querySelector(".coupon-api-response").innerHTML = error_msg;
	}
	if(url.searchParams.has("login_type")) {
		let coupon_login_tab_btn  = document.querySelector(".coupon-login-tab-btn");
		if(coupon_login_tab_btn != null) {
			coupon_login_tab_btn.click();
		}
	}
}

function showRequiredLoginTabs(login_types = "") {

	let mobile_login_tab_button = document.querySelector(".mobile-login-tab-btn");
	let coupon_login_tab_button = document.querySelector(".coupon-login-tab-btn");
	let room_login_tab_button = document.querySelector(".room-login-tab-btn");

	if(login_types != "" || login_types != null || login_types != undefined) {
		if(mobile_login_tab_button != null) {
			if(!login_types.toString().includes("mobile_login")) {
				mobile_login_tab_button.style.display = "none";
			}
		}

		if(coupon_login_tab_button != null) {
			if(!login_types.toString().includes("coupon_login")) {
				coupon_login_tab_button.style.display = "none";
			}
		}

		if(room_login_tab_button != null) {
			if(!login_types.toString().includes("room_login")) {
				room_login_tab_button.style.display = "none";
			}
		}
	}
}

function loadMobileLogin() {
	let mobile_error_ele  = document.querySelector(".mobile-error");
	let otp_error_ele = document.querySelector(".otp-error");
	let mobile_input_field = document.querySelector(".mobile");
	let otp_input_field = document.querySelector(".otp-input-field");

	if(mobile_input_field != null && mobile_error_ele != null) {
		mobile_input_field.addEventListener('focusout',(event)=> {
			mobile_valid = validateMobileInputField(event.target.value, "is-invalid", mobile_error_ele);
		});
		mobile_input_field.addEventListener('keyup',(event)=> {
			mobile_valid = validateMobileInputField(event.target.value, "is-hint", mobile_error_ele );
		});
	}
	if(otp_input_field != null && otp_error_ele != null) {
		otp_input_field.addEventListener('focusout',(event)=> {
			password_valid = validateOTPInputField(event.target.value,  "is-invalid", otp_error_ele);
		});
		otp_input_field.addEventListener('keyup', (event)=> {
			password_valid = validateOTPInputField(event.target.value, "is-hint", otp_error_ele);
		});
	}
}

function loadRoomLogin() {
	let room_number_input_field = document.RoomLoginForm.password;
	let username_input_field = document.RoomLoginForm.username;

	let room_number_error_ele = document.querySelector(".room-number-error");
	let last_name_error_ele = document.querySelector(".last-name-error")

	if(room_number_input_field != null && room_number_error_ele != null){
		room_number_input_field.addEventListener("keyup", (event) => {
			validateRoomNumberInputField(event.target.value, "is-hint", room_number_error_ele);
		});
	    room_number_input_field.addEventListener("focusout", (event) => {
			validateLastnameInputField(event.target.value, "is-invalid", last_name_error_ele);
		});
	}
	if(username_input_field != null && last_name_error_ele != null) {
		username_input_field.addEventListener("keyup", (event) => {
			validteCouponFormUsername(event.target.value, "is-hint");
		});
		username_input_field.addEventListener("focusout", (event) => {
			validteCouponFormUsername(event.target.value, "is-invalid");
		});
	}
}

/* 
	This function is for the show hint and error message of input fields on enter or focusout at coupon page
*/
function loadCouponLogin() {
	floatingLabel();
	let kyc_error_ele = document.querySelector(".kyc-error");
	let coupon_error_ele = document.querySelector(".coupon-error");

	let kyc_input_field = document.querySelector(".kyc");
	let coupon_input_field = document.querySelector(".coupon");

	if(kyc_input_field != null && kyc_error_ele != null ) {
		kyc_input_field.addEventListener('focusout',(event)=> {
			kyc_valid = validateKYCInputField(event.target.value, "is-invalid", kyc_error_ele);
		});
		kyc_input_field.addEventListener('keyup',(event)=> {
			kyc_valid = validateKYCInputField(event.target.value, "is-hint", kyc_error_ele);
		});
	}

	if(coupon_error_ele != null && coupon_error_ele != null) {
		document.querySelector(".coupon").addEventListener('focusout',(event)=> {	
			coupon_valid = validateCouponCodeInputField(event.target.value, "is-invalid", coupon_error_ele);
		});
		document.querySelector(".coupon").addEventListener('keyup',(event)=> {
			coupon_valid = validateCouponCodeInputField(event.target.value, "is-hint", coupon_error_ele);
		});
	}
}

/*
	 This function is for the disable button by it's class name
	 and apply background color and color form project json file
*/
 function buttonDisable(buttonName="", button_color_obj) {
	var button = document.querySelector("."+buttonName);
	button.disabled = true;
	button.style.backgroundColor = button_color_obj.bg_color;
	button.style.color = button_color_obj.color;
}

/* 
	This function is for the enable button by it's class name and button type
	Apply background color and color to the that button by the project json file.
*/
function buttonEnable(buttonName="", buttonType="", button_color_obj) {
	var button = document.querySelector("."+buttonName);
	if(button != null) {
		button.disabled = false;
		if(buttonType == "primary"){
			button.style.backgroundColor = button_color_obj.primary_bg_color;
			button.style.color = button_color_obj.primary_color;
		}
		else if(buttonType == "secondary"){
			button.style.backgroundColor = button_color_obj.secondary_bg_color;
			button.style.color = button_color_obj.secondary_color;
		}
		else{
			button.style.backgroundColor = button_color_obj.primary_bg_color;
			button.style.color = button_color_obj.primary_color
		}
	}
}

/*
	This function is for the send required info for the mobile validation to the inputErrorMsg function.
	This is only for the mobile input field
*/
function validateMobileInputField(value, error_type, error_ele) {
	let status = false;
	if(value == null || value == "" || value == undefined) {
		error_ele.innerHTML = `Mobile number is <strong>required</strong>`;
		errorElmentTypeToggle(error_ele, error_type);
	}
	else if(isNaN(value) || Number(value[0] <=5)){
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Mobile number is <strong>not valid</strong>`;
	}
	else if(!(/^([6-9][0-9]{9})$/).test(value)) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = "Mobile number should be 10 digits.";
	}
	else {
		errorElmentTypeToggle(error_ele, "is-valid");
		error_ele.innerHTML = ``;
		status = true;
	}
	return status;
}

function validateOTPInputField(value, error_type, error_ele) {
	let status = false;
	if(value == null || value == "" || value == undefined) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `OTP is <strong>required</strong>`;
	}
	else if(isNaN(value)){
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `OTP is <strong>not valid</strong>`;
	}
	else if( !(/^([0-9]{6})$/).test(value)) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = "OTP must contains 6 digits.";
	}
	else {
		errorElmentTypeToggle(error_ele, "is-valid");
		error_ele.innerHTML = ``;
		status = true;
	}
	return status;
}

function validateKYCInputField(value, error_type, error_ele) {
	let status = false;
	if(value == null || value == "" || value == undefined) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `KYC is <strong>required</strong>`;
	}
	else if(value.length < 7 || value.length > 9 ) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `KYC length is <strong>not matched</strong>`;

	}
	else if(!(/^([0-9A-z]{7,9})$/).test(value) ) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `KYC shoule be <strong>alphanumeric</strong>`;
	}
	else {
		status = true;
		error_ele.innerHTML = ``;
		errorElmentTypeToggle(error_ele, "is-valid");
	}
	return status;
}

function validateCouponCodeInputField(value, error_type, error_ele) {
	let status = false;
	if(value == null || value == "" || value == undefined) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Coupon code is <strong>required</strong>`;
	}
	else if(value.length != 8 )  {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Coupon code should be <strong>8 characters</strong>`;

	}
	else if(!(/^([0-9A-z]{8})$/).test(value)) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Coupon code should be <strong>alphanumeric</strong>`;
	}
	else {
		status = true;
		error_ele.innerHTML = ``;
		errorElmentTypeToggle(error_ele, "is-valid");
	}
	return status;
}

function validateRoomNumberInputField(value, error_type, error_ele) {
	let status = false;
	if(value == null || value == "" || value == undefined) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Room number is <strong>required</strong>`;
	}
	else if(value.includes(" ")) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Room number is <strong>not valid</strong>`;
	}
	else {
		errorElmentTypeToggle(error_ele, "is-valid");
		error_ele.innerHTML = ``;
		status = true;
	}
	return status;
}

function validateLastnameInputField(value, error_type, error_ele) {
	let status = false;
	if(value == null || value == "" || value == undefined) {
		errorElmentTypeToggle(error_ele, error_type);
		error_ele.innerHTML = `Name is <strong>required</strong>`;
	}
	else {
		errorElmentTypeToggle(error_ele, "is-valid");
		error_ele.innerHTML = ``;
		status = true;
	}
	return status;
}
/*
	This function is for the send required info for the mobile validation to the inputErrorMsg function.
	This is only for the COUPON input field
*/

// This function is for validating all input fields 
function inputErrorMsg(Input_field_obj) {
	var Input_name = Input_field_obj.input_name ;
	var Input_value = Input_field_obj.input_value;
	var Input_type = Input_field_obj.input_type;
	var Input_error_element = Input_field_obj.input_error_element;
	var Input_status = Input_field_obj.input_status;
	var Input_error_digits = Input_field_obj.input_error_digits;
	var Input_pattern = Input_field_obj.input_pattern; 
	var error_message = Input_field_obj.input_error_msg_field;
	var error_type = Input_field_obj.error_type; 

	var selected_element_error = document.querySelector("."+Input_error_element);
	if(Input_value == "") {
		Input_status = false;
		elmentTypeToggle();
		selected_element_error.classList.replace('is-valid', error_type);
		selected_element_error.innerHTML = error_message+" "+"is <strong> required</strong>";
	}
	else if(Input_name == "confirmpin" && Input_pattern.test(Input_value)){
		let setpin_value = document.querySelector(".setpin").value;
		if(Input_value == setpin_value) {
			Input_status = true;
			selected_element_error.classList.replace(error_type,'is-valid');
			selected_element_error.innerHTML = "";
		}
		else {
			Input_status = false;
			elmentTypeToggle();
			selected_element_error.innerHTML = error_message+" "+ "is not matched";
		}
	}
	else if(Input_pattern.test(Input_value)) {
		Input_status = true;
		selected_element_error.classList.replace(error_type,'is-valid');
		selected_element_error.innerHTML = "";
	}
	else {
		Input_status = false;
		elmentTypeToggle();
		selected_element_error.innerHTML = error_message+" "+Input_error_digits;
	}

	if(Input_type == "numeric") {
		if(Input_name == "mobile") {
			// This condition checks mobile value starts with 0-5 or not
			if(isNaN(Input_value) || Number(Input_value[0] <=5)){
				Input_status = false;
				elmentTypeToggle();
				selected_element_error.classList.replace('is-valid', error_type);
				selected_element_error.innerHTML = error_message+" "+"is <strong>not valid</strong>";
			}
		}
	}
	
	// This function is for change the error type 
	function elmentTypeToggle() {
		if(selected_element_error.classList.value.includes("is-invalid")){
			selected_element_error.classList.replace( 'is-invalid', error_type);
		}
		else if(selected_element_error.classList.value.includes("is-hint")){
			selected_element_error.classList.replace( 'is-hint', error_type);
		}
		else {
			selected_element_error.classList.replace( 'is-valid', error_type);
		}
	}
	return Input_status;
}

function errorElmentTypeToggle(ele, error_type) {
	if(ele.classList.value.includes("is-invalid")){
		ele.classList.replace( 'is-invalid', error_type);
	}
	else if(ele.classList.value.includes("is-hint")){
		ele.classList.replace( 'is-hint', error_type);
	}
	else {
		ele.classList.replace( 'is-valid', error_type);
	}
}

// This function shows a linear progress abr to the buttons
function linerProressBar(btn_id = "", progress = false) {
	const overallProgress = mdc.linearProgress.MDCLinearProgress.attachTo(document.querySelector("#"+btn_id));
	if(progress == false) {
		overallProgress.close();
	}
	else if(progress == true) {
		overallProgress.open();
		overallProgress.determinate = false;
	}
	else{
		overallProgress.close();
	}
}

// This function for set main container height according to the header and footer height
function setMainContainerHeight(project_id) {
	let body_height = document.body.offsetHeight;
	let header_ele = document.querySelector("header");
	let footer_ele = document.querySelector(".footer");
	let main_container = document.querySelector(".main-content");

	if(body_height != null && header_ele != null && footer_ele != null) {
		let main_content_height = body_height - header_ele.clientHeight - footer_ele.clientHeight;
		if(main_container != null) {
			main_container.style.minHeight = main_content_height + "px";
		}
		if(project_id == "igidel-encalm-lounge" || project_id == "igidel-encalm-spa-lounge" || project_id == "igidel-encalm-vip-lounge" || project_id == "transit-hotel-wifi") {
			main_container.style.minHeight = main_content_height+ "px";
		}
	}
}

// This function is for the common header content applied to the all pages
function setHeader(logo_url, project_name, project_id, logo_position) {
	let header =  document.querySelector("header");
	if(header != null) {
		header.innerHTML = `
			<div class="mdc-top-app-bar__row app-header">
				<img class="logo" alt="alternative test" height="40px" width="auto">
			</div> 
		`;
		let logo = document.querySelector(".logo");
		let app_header = document.querySelector(".app-header");

		if(app_header != null) {
			app_header.setAttribute("style", "display: flex;flex-direction: row; align-items: center");
			if(logo_position == "left") {
				app_header.setAttribute("style", "Justify-content: start");
			}
			else if(logo_position == "center") {
				app_header.setAttribute("style", "justify-content: center");
			}
			else if(logo_position == "right") {
				app_header.setAttribute("style", "justify-content: end");
			}
		}

		if(logo != null) {
			logo.setAttribute('src',logo_url);
			logo.alt = project_name;
		}

		if(project_id == "igidel-encalm-lounge" || project_id == "igidel-encalm-spa-lounge" || project_id == "igidel-encalm-vip-lounge" || project_id == "transit-hotel-wifi" ) {
			if(header != null) {
				header.setAttribute("style", "height: 80px")
			}
			if(logo != null) {
				logo.setAttribute("style", "height:65px; filter: brightness(0.5)");
			}
		}

		else if(project_id == "igidel-amex-lounge") {
			if(logo != null) {
				//header.setAttribute("style", "height: 64px")
				//logo.setAttribute("style", "height: 64px;")
				//document.querySelector(".app-header").setAttribute('style', "padding-top: 0px !important;")
			}
		}
	}
}

// This Function id for the common footer content applied to the all pages
function setFooter(project_id, tmt_logo, tmt_logo_visible) {
	let footer = document.querySelector(".footer-container");
	if(footer != null) {
		footer.innerHTML = `
			<div class="mdc-top-app-bar__row footer">
				<div class="footer-content"> 
					<p>© <span class="year"></span> Transmedia DigiComm Private Limited</p>
				</div>
				<div class="footer-img">
					<img loading="lazy" src="${tmt_logo}" width="40px" />
				</div>
			</div>
			`
		let year = document.querySelector(".year");
		if(year != null) {
			year.innerText = new Date().getFullYear();
		}
		let footer_content  = document.querySelector(".footer-content");
		if(footer_content != null) {
			let footer_text = footer_content.innerText;
			footer_text.includes("Â©") ? footer_text.replace("Â©", "©") : footer_text;
		}
		if(tmt_logo_visible == false ) {
			let footer_image = document.querySelector(".footer-img");
			let footer_container = document.querySelector(".footer");
			if(footer_image != null) {
				footer_image.style.display = "none";
			}
			if(footer_container != null) {
				footer_container.style.flexDirection = "column";
			}
		}
	}
}

// This function is to show and hide faq content in page based on the config file
function faqContentInpage(faq_req, faq_inpage, project_id) {
	let faq_required_flag = faq_req;
	let faq_content_flag = faq_inpage;
	if(faq_content_flag == true && faq_required_flag == true) {
		let faq_container = document.querySelector(".faq-container");
		if(faq_container != null) {
			faq_container.innerHTML = `
				<div class="mdc-card card ">				
					<div class="card-content">
						<p class="card-title">FAQ</p>
						<div class="faq-content"></div>
					</div>
				</div>
			`;
		}
		loadFaqTemplate(project_id);
	}
}

// This function is to show and hide faq link in page based on the config file
function displayFaqlink(faq_req) {
	let faq_required_flag = faq_req;
	if(faq_required_flag == true) {
		let faq_container_link = document.querySelector(".faq-container-link");
		if(faq_container_link != null) {
			faq_container_link.innerHTML = `
				<section class="card-info">
					<span class="material-icons mdc-icon" style="margin:auto 8px;">help</span>
					<a href="#" onclick="openFaqPage()"> FAQs.</a>
				</section>
			`
		}
	}
}

// This function is to show and hide top and main advertisement banners based on the config file
function showHideAdvBanners(top_adv_banner, main_adv_banner, banner_url, full_banner_url, project_id) {
	let topAdvBannerFlag = top_adv_banner
	let mainAdvBannerFlag = main_adv_banner;

	let full_banner = document.querySelector(".full-banner");
	let banner = document.querySelectorAll(".banner");
	if(project_id == "goa-airport") {
		if(full_banner != null) {
			full_banner.style.minHeight = "14em";
		}
	}

	if(banner != null) {
		for (const banner_element of banner) {
			if(topAdvBannerFlag == true){
				banner_element.setAttribute('src',banner_url)
			}
			else if(topAdvBannerFlag == false){
				banner_element.style.display = "none";
			}
			else {
				console.log("Something went wrong in getting banner image");
			}
		}
	}
	if(full_banner != null) {
		if(mainAdvBannerFlag == true){
			full_banner.setAttribute('src', full_banner_url);
		}
		else if(mainAdvBannerFlag == false){
			full_banner.style.display = "none";
		}
		else {
			console.log("Something went wrong in getting full banner image");
		}
	}
}

// This function is to show seesion time left card on status page
function logedinSessionTime() {
	let session_left_conatainer = document.querySelector(".session-left-container");
	let session_left =  document.querySelector(".session-left");
	if(session_left_conatainer != null) {
		session_left_conatainer.innerHTML = ` 
			<div class="mdc-card card">
				<section class="card-info">
					<span class="material-icons mdc-icon" style="margin:auto 8px;">info</span>
					<p class="">Your daily session time left is <strong>${session_left.innerText}</strong></p>
				</section>
			</div>
		`;
	}
}

// This function is to show note under the mobile login and coupon login pabs
function LoginNotes(project_id) {
	let domestic_login_note = document.querySelector(".domestic-login-note");
	let international_login_note = document.querySelector(".international-login-note");
	if(project_id == "igidel-free-wifi") {
		if(domestic_login_note != null) {
			domestic_login_note.innerHTML = `
				<b>Note: </b>This is only for passenger, who have Indian mobile number. If passenger don't have Indian mobile number please click on coupon login.
			`;
		}
		if(international_login_note != null) {
			international_login_note.innerHTML = `
				<b>Note: </b> This is for the passengers, who don't have indian mobile number. Passenger having a passport please click for Kiosk location <a href="#" onclick="openDialog('kiosk');">information kiosk</a> or contact <a href="#" onclick="openDialog('helpdesk');">Help desk</a>
			`;
		}
	}
	if(project_id == "goa-airport") {
		if(domestic_login_note != null) {
			domestic_login_note.innerHTML = `
				<b>Note: </b>This is only for passenger, who have Indian mobile number. If passenger don't have Indian mobile number please click on coupon login.
			`;
		}

		if(international_login_note != null) {
			international_login_note.innerHTML = `
				<b>Note: </b>This is for the passengers, who dont have indian mobile number. Passenger having a passport please contact Help desk;
			`;
		}
	}
	if(project_id == 'igidel-encalm-lounge' || project_id == "igidel-encalm-spa-lounge" || project_id == "igidel-encalm-vip-lounge") {
		if(domestic_login_note != null) {
			domestic_login_note.innerHTML = `
				<b>Note: </b>This is only for passenger, who have Indian mobile number. If passenger don't have Indian mobile number please click on coupon login.
			`;
		}

		if(international_login_note != null) {
			international_login_note.innerHTML = `
			<b>Note: </b> This is for the passengers, who don't have indian mobile number. Passenger having a passport please click for Kiosk location <a href="#" style="coloe:blue" onclick="openDialog('kiosk');">information kiosk</a> or contact <a href="#" style="color: blue" onclick="openDialog('helpdesk');">Help desk</a>
			`;
		}
	}
	if(project_id == "igidel-airindia-lounge") {
		if(international_login_note != null) {
			international_login_note.innerHTML = `
				<b>Note: </b> Get coupon code from domestic food court area and international food court area helpdesks.
			`;
		}
	}
}

// This function is to hide tabs and only show coupon login.
function signinPageTabs(domesticLogin, internationalLogin) {
	let tab_container = document.querySelector(".tab-container");
	let international_login = document.querySelector(".international-login");
	let domestic_login = document.querySelector(".domestic-login");

	if(domesticLogin == false || internationalLogin == false) {
		if(tab_container != null) {
			tab_container.style.display = "none";
		}
		if(domesticLogin == false) {
			if(domestic_login != null) {
				if(domestic_login.classList.contains("content--active")) {
					domestic_login.classList.remove("content--active");
					domestic_login.style.display = "none";
				}
			}
		}
		if(internationalLogin == false) {
			if(international_login != null) {
				if(international_login.classList.contains("content--active")) {
					international_login.classList.remove("content--active");
					international_login.style.display = "none";
				}
			}
		}
		else {
			international_login.classList.add("content--active");
		}
	}
		
	
}

// This function returns helpdesk location list.
function helpdeskLocations() {
	let helpdesk_locations = [
		{
			terminal_name : "Terminal 2",
			location_name: "T2 Arrival",
			landmarks: ["opp. belt no. 3 & 4"]
		},
		{
			terminal_name : "Terminal 2",
			location_name: "T2 Check-IN-Area",
			landmarks: ["beside thomas cook exchange", "opp. d-row"]
		},
		{
			terminal_name : "Terminal 2",
			location_name: "T2 Departure",
			landmarks: ["opp. sun glass hut", "near lift no. 10"]
		},
		{
			terminal_name : "Terminal 3",
			location_name: "T3 Domestic Departure",
			landmarks: ["opp. BIBA"]
		},
		{
			terminal_name : "Terminal 3",
			location_name: "T3 Check-In Area",
			landmarks: ["opp. gate 5 entrace", "opp. costa coffee"]
		},
		{
			terminal_name : "Terminal 3",
			location_name: "T3 International Retail",
			landmarks: ["near ralph lauren", "opp. costa coffee"]
		},
		{
			terminal_name : "Terminal 3",
			location_name: "T3 UK Lounge - International Arrival",
			landmarks: ["near belt no. 3"]
		},
		{
			terminal_name : "Terminal 3",
			location_name: "T3 International Arrival",
			landmarks: ["near belt no. 12"]
		}
	];
	return helpdesk_locations;
}

// This function returns kiosk location list
function kioskLocations() {
	let kiosk_locations = [
		{
			terminal: "Terminal 3",
			location_name : "T3 Check in area",
			landmarks: ["Right side near to costa coffe shop", "opp. gate 5"]
		},
		{
			terminal: "Terminal 3",
			location_name : "T3 international Arrival",
			landmarks: ["near custom checking"]
		},
		{
			terminal: "Terminal 3",
			location_name : "T3 Belt Area",
			landmarks: ["between Belt no. 10 and 12"]
		},
		{
			terminal: "Terminal 3",
			location_name : "T3 international arrival transfer area",
			landmarks: ["near SCCR 9"]
		},
		{
			terminal: "Terminal 3",
			location_name : "T3 International Retail",
			landmarks: ["near shop DaMilano and pashma", "near delhi duty free departure"]
		}
	];
	return kiosk_locations;
}

// This function returns privacy policy content.
function privacyPolicy() {
	let privacy_policy = `
		<div style="height:100%">
			<div class="ic_para_content">
				Privacy of your information is of utmost importance to us. GMR Infrastructure Limited (“GMR” or “we”) takes the privacy of your information seriously. This privacy notice applies to information we collect about you in the different sections of the website. The information we collect about you is used to revert to you with relevant answers or to help you with a service.
			</div>
			<div class="ic_para_content">This privacy policy applies to the main website <a href="https://www.gmrgroup.in/home/#our-journey/slide12" target="_blank">www.gmrgroup.in</a>, as well as in the other domains and sub-domains owned and operated by the GMR entities. </div>
			<div class="ic_para_head bold">1. Definitions</div>
			<div class="ic_para_content">In this privacy policy, the following definitions are used:</div>
			<div class="ic_para_content">
				<ul class="dialul mb-3">
					<li>Data: Includes information that you submit to GMR via the Website, and information which is accessed by GMR pursuant to your visit to the Website.</li>
					<li>Cookies: A small file placed on your computer by this Website when you either visit, or use certain features of, the Website. A cookie generally allows the website to “remember” your actions or preference for a certain period of time.</li>
					<li>Data Protection Laws: Applicable laws in India, including the Information Technology Act, 2000, as amended or substituted.</li>
					<li>GMR or us: Naman Centre, 7th Floor, Opp. Dena Bank, Plot No. C-31, G Block, Bandra Kurla Complex, Bandra (East), Mumbai, Maharashtra, India - 400051.</li>
					<li>Grievance Officer: Officer designated by GMR</li>
					<li>
						User or you: The natural person who accesses the Website
					</li>
					<li>Website: The website that you are currently using, and any sub-domains of this site, unless excluded by their own terms.</li>
				</ul>
			</div>
			<div class="ic_para_head bold">2. Scope</div>
				<div class="ic_para_content">
					Collection of data to operate this website and other websites and/or webpages, owned and/or operated by GMR. You provide some of this data directly, such as when you submit an entry (through the general query, media query, newsletter subscription, job applications or such other manner specified on the website).
				</div>
				<div class="ic_para_content">You can visit this website <b>without</b> telling us who you are.</div>
				<div class="ic_para_content">We shall not be responsible for the authenticity of the personal information or sensitive personal data or information supplied by the user/provider.</div>
				<div class="ic_para_head bold">3. Data Collected:</div>
				<div class="ic_para_content">We may collect information or pieces of information that could allow you to be identified, including:</div>
			<div class="ic_para_content">
				<ul class="dialul mb-3">
					<li>Contact information: We primarily collect first name, last name and email address.</li>
				</ul>
			</div>
			<div class="ic_para_head bold">4. Collection of Data:</div>
			<div class="ic_para_content">
				<ul class="dialul mb-3">
					<li>People who subscribe or register to receive information from GMR Group e.g. GMR Group Newsletter.</li>
					<li>People who provide feedback to GMR Group via our websites.</li>
					<li>Job applicants.</li>
					<li>Visitors to our website.</li>
				</ul>
			</div>
			<div class="ic_para_head bold">5. Data that is Collected Automatically</div>
			<div class="ic_para_content">
					<ul class="dialul mb-3">
					<li>When someone visits our websites we collect standard internet log information and details of visitor behaviour patterns. We do this by using cookies which record those areas of our websites that have been visited by your computer, for how long and what activity was undertaken on our website. We do this to identify the most popular parts of our websites, also to improve your experience. We collect this information in a way which does not identify anyone. We do not make any attempt to find out the identities of those visiting our website</li>
					<li>Our web servers or affiliates who provide analytics and performance enhancement services collect IP address, operating system details, browsing details, device details and language settings. This information is aggregated to measure the number of visits, average time spent on the site, pages viewed and similar information. GMR group uses this information to measure the site usage, improve content and to ensure safety and security, as well enhance performance of the Website.</li>
					<li>For more information about Cookies, please see the section below, titled “Cookies”.</li>
				</ul>
			</div>
			<div class="ic_para_head bold">6. Our Use of Data</div>
			<div class="ic_para_content">If you are giving us your personal information in the course of registering or subscribing to a service or product at our website, then we will only use your information in order to provide you with that service or for closely related purposes. Specifically, Data may be used by us for the following reasons:</div>
			<div class="ic_para_content">
				<ul class="dialul mb-3">
					<li>improvement of our products or services, as well as of our group entities;</li>
					<li>transmission by email or any other form of communication of marketing materials to you;</li>
					<li>contact for survey or feedback which may be done using email or mail;</li>
					<li>to enable our group entities to reach out to you in relation to their programmes managed by them / products or services offered by them;</li>
					<li>to process your requests (such as replying to your queries); and</li>
					<li>to execute other activities such as marketing campaign, promotional communications for which consent is taken appropriately.</li>
				</ul>
			</div>
			<div class="ic_para_head bold">7. Who we share Data with</div>
				<div class="ic_para_content">
					We may share your personal Data with:
				</div>
				<div class="ic_para_content">
				<ul class="dialul mb-3">
					<li>GMR group-controlled affiliates and subsidiaries and other entities within the GMR group of companies, to assist them to reach out to you in relation to their programs or campaigns (including marketing and sales) and to process your query / requests (such as job application);</li>
					<li>service-providers who assist in protecting and securing our systems and provide services to us which require the processing of personal data, such as to host your information or to process your information for data profiling and user analysis.</li>
					<li>In the majority of cases we will not disclose your personal information to others unless we have previously gained your consent to the same. However, there will be circumstances where we may disclose your personal information without your consent e.g. where we are required by law to disclose information or where the information is required to prevent or detect a crime. In the case of all disclosures, we will always ensure the disclosure is legitimate and proportionate for the purpose for which the information is sought to be disclosed.</li>
					<li><b>Keeping Data secure</b>We use technical and organizational measures to safeguard your Data and we store your Data on secure servers. Technical and organizational measures include measures to deal with any suspected data breach.</li>
				</ul>
			</div>
			<div class="ic_para_content">If you suspect any misuse or loss or unauthorized access to your Data, please let us know immediately by contacting us via e-mail to our Grievance Officer.</div>
			<div class="ic_para_head bold">8. Retention of Personal Data</div>
			<div class="ic_para_content">GMR will keep your personal information relating to services or products purchased in line with our retention policy which ensures that we keep your details for no longer than is necessary. Your information will be retained in a secure environment and access to it will be restricted according to the 'need to know' principle. However, even if we delete your Data, it may persist on backup or archival media for our audit, legal, tax or regulatory purposes only.</div>
			<div class="ic_para_head bold">9. Personal Data Security</div>
			<div class="ic_para_content">GMR is committed to protecting the security of your Data. We use a variety of security technologies and procedures to help protect your personal data from unauthorized access, use or disclosure. Further, we have adequate internal policies to protect and safeguard any personal identifiable information. </div>
			<div class="ic_para_content">If the Information Provider needs to access update or correct his / her Information, he/she may contact the designated person mentioned below for the same.</div>
			<div class="ic_para_head bold">10. Data Storage and Processing</div>
			<div class="ic_para_content">In general, personal Data collected and processed under this policy is hosted on servers located in India. We take steps to ensure that the Data we collect under this privacy policy is processed according to the provisions of this policy and the requirements of applicable laws of India.</div>
			<div class="ic_para_head bold">11. Links to other websites </div>
			<div class="ic_para_content">This site might contain links to sites outside this website. GMR shall not be held responsible for the privacy practices, the content, the authentic nature or safety of such other websites. We encourage you to read the privacy statements on the other websites you visit.</div>
			<div class="ic_para_head bold">12. Cookies</div>
			<div class="ic_para_content">GMR group websites may place and access certain Cookies on your computer. GMR uses Cookies to improve your experience of using the Website.</div>
			<div class="ic_para_content">Before the Website places Cookies on your computer, you will be presented with a message bar requesting your consent to set those Cookies. You may, if you wish, deny consent to the placing of Cookies; however certain features of the Website may not function fully or as-intended.</div>
			<div class="ic_para_content">You can choose to enable or disable Cookies in your internet browser. By default, most internet browsers accept Cookies, but this can be changed. For further details, please consult the help menu in your internet browser.</div>
			<div class="ic_para_content">This Website may place the following Cookies:</div>
			<div class="ic_para_content">
				<ul class="dialul mb-3">
					<li>Type of Cookie: Marketing & analytics cookies Purpose: This cookie is necessary to display content in expand / collapse format on pages.</li>
					<li>Type of Cookie: _utma, _utmb, _utmc, _utmz,display_features_cookie:</li>
					<li>Purpose: Google Analytics is used on the Websites to track visitor traffic and site performance traffic by collecting anonymous information about the average time spent on the website, the pages viewed and other relevant usage statistics. To opt out of being tracked by Google Analytics visit: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">https://tools.google.com/dlpage/gaoptout</a></li>
				</ul>
			</div>
			<div class="ic_para_content">You can choose to delete Cookies at any time. However, you may lose any information that enables you to access the Website more quickly and efficiently including, but not limited to, personalisation settings. <b>To find out more about cookies, visit</b> <a href="https://www.aboutcookies.org/" target="_blank">www.aboutcookies.org</a></div>
			<div class="ic_para_head bold">13. Changes to this privacy notice</div>
			<div class="ic_para_content">GMR reserves the right to change, alter, modify or add terms in this privacy policy as required by law or as and when it may deem necessary. You are deemed to have accepted the terms of the privacy policy on your first use of the Website following the alterations.</div>
			<div class="ic_para_head bold">14. Grievance</div>
			<div class="ic_para_content">We have nominated Mr. Shatrunjay Krishna (Ph : 91 1142532600) as the Grievance Officer. The Information Provider(s) may approach the Grievance Officer if he/ she or they have any grievance(s), question(s) or concern(s) with respect to the processing and use of their Personal Information. The Grievance Officer can be contacted by mail at the email id Grievance.Officer@gmrgroup.in We do suggest you to email rather than raise a telephonic concern for a swift response and better understanding of grievance, questions or concerns.</div>
		</div>
	`;
	return privacy_policy;
}

// This function returns terms and conditions content.
function termsAndConditions() {
	let terms_and_conditions = `
		<div style="height:100%">							
			<div class="terms-privacy-div">
				<div class="ic_para_head bold">
					READ CAREFULLY BEFORE USING THIS WEB SITE :
				</div>
				<div class="ic_para_content mt-3">
					<p>By using this website, you agree to all of below mentioned terms and conditions and if you do not agree with all these terms and conditions, do not access or use the Website.</p>
				</div>
				<ol>
					<li class="ic_para_head bold">Introduction</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none;">
							<li>
								<b>1.1</b> These terms and conditions ("Terms") govern your viewing and use of this website (the "Website") which is owned and operated by Delhi International Airport Limited (DIAL). For the purposes of these Terms "we", "our" and "us" refers to DIAL.
							</li>
							<li>
								<b>1.2 </b> At this Website, We have made information available about DIAL, its operations and the airport. We have also partnered with many others to give you wholesome and relevant information regarding your complete travel plans and services that you may need. We wish to make the site more and more relevant for you in the days to come.
							</li>
							<li>
								<b>1.3</b> These Terms only apply to your viewing of this Website. When you reach any other website - even if they are our partner websites (Example: Ixigo.com for flight and hotel bookings) then please note that your viewing of these websites and any purchases made through them will be subject to separate terms and conditions as applicable to those websites.
							</li>
							<li>
								Please read these Terms carefully. .
							</li>
						</ol>
					</div>
					<li class="ic_para_head bold">Information on flight arrivals, departures, timetables and destinations</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none;">
							<li>
								<b>2.1</b> With regard to flight arrivals and departures, flight destination and timetable please note that the flight arrivals and departures screen contains the scheduled arrival and departure times of most flights. We can only update the flight arrivals and departures screens once the airlines have told us that a particular flight is early, delayed or cancelled. Therefore we are not in a position to guarantee the accuracy of that information. We always advise telephoning the airline in advance if you have concerns that a particular flight may have been cancelled or delayed.
							</li>
							<li>
								<b>2.2</b> All information provided by the Website is subject to clause 11 of these Terms.
							</li>
						</ol>
					</div>
					<li class="ic_para_head bold">Investor relations</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li>
								<b>3.1</b> We have included certain information on the Website about the corporate affairs of DIAL. However, such information is provided for your convenience only, and we do not give any advice, make any recommendation or endorsement as to any investment. No information or otherwise on this Website constitutes an invitation to invest in shares in DIAL or any other company and you should not make (or decide not to make) any investment or other decisions based on what you see in or via this Website.
							</li>
						</ol>
					</div>
					<li class="ic_para_head bold">Our responsibilities to you</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none;">
							<li>
								<b>4.1 </b> Although we have made every effort to ensure that the information contained on this Website will be relevant and useful, we cannot make any commitment that it will meet your particular requirements. For the reasons described above, and because also of frequent changes to the shops and facilities at the airport, we cannot guarantee that the information on the Website will always be completely accurate.
							</li>
							<li>
								<b>4.2</b> Although we make every effort to ensure that the Website is available at all times, there will be occasions on which we will need to carry out routine and emergency maintenance of the Website. We do not therefore guarantee that it will always be available, or that it will always perform at a particular speed or with particular functionality. We reserve the right to withdraw the Website if we need to.
							</li>
							<li><b>4.3</b> Subject to clauses 11 &amp; to the maximum extent permitted by law, all representations, warranties, terms, conditions and commitments not expressly set out in these Terms are hereby excluded.</li>
						</ol>
					</div>
					<li class="ic_para_head bold">Your obligations when using the Website</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li>
								<b>5.1</b> In particular, you agree that you will not:
							</li>
							<ol style="list-style-type:none;">
								<li>
									<b>5.1.1</b> Post, transmit or disseminate any information on or via this Website which is or may be harmful, obscene, defamatory or otherwise illegal;
								</li>
								<li><b>5.1.2</b> Use this Website in a manner which causes or may cause an infringement of our rights (including but not limited to intellectual property rights) or the rights of any other</li>
								<li><b>5.1.3</b> Make any unauthorised, false or fraudulent booking;</li>
								<li><b>5.1.4</b> Use any software, routine or device to interfere or attempt to interfere electronically or manually with the operation or functionality of this Website including but not limited to uploading or making available files containing corrupt data or viruses via whatever means;</li>
								<li><b>5.1.5</b> Deface, alter or interfere with the front end 'look and feel' of this Website;</li>
								<li><b>5.1.6</b> Take any action that imposes an unreasonable or disproportionately large load on this Website or related infrastructure</li>
								<li><b>5.1.7</b> Obtain or attempt to obtain unauthorised access, via whatever means, to any of our networks</li>
							</ol>
							<li><b>5.2</b> We reserve the right to suspend or terminate your access and use of the Website at any time if you breach these Terms.</li>
						</ol>
					</div>
					<li class="ic_para_head bold">Intellectual Property Rights</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li><b>6.1</b> All trade marks, copyright, database rights and other intellectual property rights (together "the Rights") in the materials on this Website (as well as the organisation and layout of this Website) and the Rights in any software or underlying software code that is made available for download from the Website ("Software") are owned by us or our licensors.</li>
							<li><b>6.2</b> Except as stated in paragraph 6.4 below, without our prior written permission, you may not copy, reproduce, modify, alter, publish, broadcast, distribute, display, post, sell, transfer or transmit in any form or by any means any material on this Website or Software whether in whole or in part nor use the material or Software to create derivative works</li>
							<li><b>6.3</b> The contents of the pages contained in this Website may not be distributed, displayed or copied to third parties including, but not limited to, "caching" any material on this Website for access by third parties and "mirroring" any material on this Website</li>
							<li><b>6.4</b> The contents of individual pages of this Website may be printed or downloaded to disk for the purpose of private and personal non-commercial use.</li>
							<li><b>6.5</b> You may not do any of the following without our written permission:</li>
							<ol style="list-style-type:none">
								<li>
									<b>6.5.1</b> Remove the copyright or trade mark notice from any copies of content under these Terms; or
								</li>
								<li>
									<b>6.5.2</b> Create a database in electronic or structured manual form by systematically downloading and storing any content
								</li>
							</ol>
						</ol>
					</div>
					<li class="ic_para_head bold">Feedback</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li><b>7.1</b> From time to time we may request you to provide us with your views on our airports, services, the Website or any other related issue. Our use of your contribution together with the personal information you provide will be governed by these terms and conditions and by the terms of our Privacy Policy</li>
						</ol>
					</div>
					<li class="ic_para_head bold">Changes to these Terms</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li><b>8.1</b> We reserve the right, at our discretion, to make improvements or changes to any part of the Website, including to these Terms. We therefore recommend that you re-visit this page from time to time.</li>
						</ol>
					</div>
					<li class="ic_para_head bold">General</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li><b>9.1</b> These Terms refer only to your viewing of this Website and, as detailed above, separate conditions apply to prize draws, competitions and promotions which we may run from time to time as well as to products and services sold through this Website.</li>
						</ol>
					</div>
					<li class="ic_para_head bold"> Data Protection and Privacy</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li><b>10.1</b> Any personal information you supply to us when you use this Website will be used in accordance with our Privacy Policy.</li>
						</ol>
					</div>
					<li class="ic_para_head bold"> WARRANTY DISCLAIMER AND LIMITATION OF LIABILITY</li>
					<div class="ic_para_content">
						<ol style="list-style-type:none">
							<li><b>11.1</b> We shall not be liable for the performance or non-performance of the Website for any claims of any nature arising out of any Website Partner's acts or omissions, breach of contract, breach of warranty, failure to pay commissions, or any other cause.</li>
							<li>
								<b>11.2</b> Neither, we nor our Website partners make any warranty or representation of any kind nor assume any liability of any kind regarding the use of the following
							</li>
							<ol style="list-style-type:none">
								<li><b>11.2.1 </b> the Website and/or any information, content or data provided on or through the Website, all of which are provided on an "as is" basis;</li>
								<li><b>11.2.2</b> The availability, accuracy, complete-ness, timeliness or reliability of any of the information, content or data found on this site;</li>
								<li><b>11.2.3</b> viruses that may infect your computer equipment or other property on account of your access to, use of, or browsing in the site or your downloading of any content, materials, text, images, video or audio from the site or sites to which the Website may be linked;</li>
							</ol>
							<li><b>11.3</b> In no event shall, we or our Website partners be liable for any injury, loss, claim, damage, direct or otherwise, including any consequential, special, exemplary, punitive, indirect or incidental damages of any kind (including, but not limited to lost profits, revenue or savings), or any cost or expense, whether based in contract, tort, warranty, strict liability or otherwise, which arises out of or is in any way connected with the Website.</li>
						</ol>
					</div>
					<li class="ic_para_head bold">GOVERNING LAW AND JURISDICTION</li>
					<div class="ic_para_content mt-2">
						<p> The laws of India, without regard to its conflicts of law provisions, shall govern this Agreement and its performance. You consent and submit to the jurisdiction of the courts located at New Delhi, India, in all questions and controversies arising out of this Agreement and your use of the Website.</p>
					</div>
				</ol>
			</div>
		</div>
	`;
	return terms_and_conditions;
}


// This function returns the rating ui
function ratingHtml(form="") {
	let rating_html  = `
		<main class="main-content">
			<div class="container">
				<div class="mdc-card card">
					<div class="card-content">
						<div class="rating-box">
							<p class='rating-text'>How was your connecting experience?</p>
							<div class="rating-container"></div>
						</div>
						<div class="chip-container" style="display:flex; flex-direction:row; flex-wrap: wrap"></div>
						
						<div class="rating-message-text rating-input-field">
							<form name="ratingForm">
								<label class="mdc-text-field mdc-text-field--filled mdc-text-field--textarea" style="width:-webkit-fill-available">
									<span class="mdc-text-field__ripple"></span>
									<span class="mdc-floating-label" id="my-label-id"><p style="margin:0px">Your valuable feedback, improves our service</p></span>
									<span class="mdc-text-field__resizer">
										<textarea class="mdc-text-field__input feed-back-input-msg"  name="feedbackMsg" value="" rows="4" cols="40" aria-label="Label" maxlength="250"></textarea>
									</span>
									<span class="mdc-line-ripple"></span>
								</label>
								<div class="mdc-text-field-helper-line">
									<div class="mdc-text-field-character-counter">0 / 250</div>
								</div>
							</form>
						</div>
						<div style="margin:8px">
							<div class="rating-api-response" style="color:red; text-align: center;"></div>
						</div>
						<div class="buttons">
							<button type="button" class="mdc-button button mdc-button--raised rating-sub-btn">
								<span class="mdc-button__label">SUBMIT & CONNECT</span>
							</button>
							<div role="progressbar" class="mdc-linear-progress" id="star-Rating-Btn-Progress">
								<div class="mdc-linear-progress__bar mdc-linear-progress__secondary-bar">
									<span class="mdc-linear-progress__bar-inner"></span>
								</div>
								<div class="mdc-linear-progress__bar mdc-linear-progress__secondary-bar">
									<span class="mdc-linear-progress__bar-inner"></span>
								</div>
							</div>
							<button type="button" class="mdc-button mdc-button--outlined button" style="color: blue" onclick='closeRatingDialog("${form}")' >
								<span class="mdc-button__ripple"></span>
								<span class="mdc-button__label">SKIP</span>
							</button>	
						</div>
					</div>
				</div>
			</div>
		</main>	
	`;
	return rating_html;
}

// This function returns star rating ui
function starRatingHtml() {
	let rating_text = ['Poor', 'Fair', 'Good','Very Good', 'Excellent'];
	let rating_container = document.querySelector(".rating-container");
	rating_container.classList.add('stars');
	for(let i=0; i < rating_text.length; i++){
		let output = `
			<div style="display:flex; flex-direction:column;">
				<div style="flex:1 1 auto;"">
					<i class="material-icons">star</i>
		`;
		if(i==3)
			output += `<br><small>${rating_text[i]}</small>
			</div>
		</div>`;
		else
			output += `<small style="margin:8px">${rating_text[i]}</small>
			</div>
		</div>`;
		rating_container.innerHTML += output;
	}
	StarRatingValue();
}

/*function for dialog boxes */
function openDialog(dialog_box_name = "", form_name=""){
	var dialog_box = document.querySelector(".dialog-box");
	var  dialog_box_header = document.querySelector(".dialog_header");
	var dialog_box_content = document.querySelector(".dialog-content");
	const unorder_list = document.createElement('ul');
	dialog_box_content.innerHTML = "";
	dialog_box.classList.add('mdc-dialog--open');
	dialog_box_content.scrollTop = 0;
	if(dialog_box_name == "privacy_policy"){
		dialog_box_header.innerHTML = 
		`<h2 class="mdc-dialog__title">Privacy Policy</h2>
		<button class="mdc-icon-button material-icons mdc-dialog__close" data-mdc-dialog-action="close" onclick="closeDialog();">close</button>`;
		dialog_box_content.innerHTML = privacyPolicy();
	}
	if(dialog_box_name == "terms_coditions"){
		dialog_box_header.innerHTML = 
			`<h2 class="mdc-dialog__title">Terms and Conditions</h2>
			<button class="mdc-icon-button material-icons mdc-dialog__close" data-mdc-dialog-action="close"  onclick="closeDialog();">close</button>`;
		dialog_box_content.innerHTML = termsAndConditions();
	}
	if(dialog_box_name == "kiosk" || dialog_box_name == "helpdesk") {
		var header_name = "";
		let location_data;
		let header_description = document.createElement("p");
		
		if(dialog_box_name == "kiosk"){
			header_name = "KIOSK LOCATIONS";
			location_data = kioskLocations();
			header_description.innerHTML = "Please collect coupon at a any of the following kiosk locations to connect to FREE-WIFI"
		}
		if(dialog_box_name == "helpdesk"){
			header_name = "HELPDESK LOCATIONS";
			location_data = helpdeskLocations();
			header_description.innerHTML = "Please collect coupon at a any of the following help desk locations to connect to FREE-WIFI "
		}
		dialog_box_header.innerHTML = `
			<h2 class="mdc-dialog__title">${header_name}</h2>
			<button class="mdc-icon-button material-icons mdc-dialog__close" data-mdc-dialog-action="close" id="closeTerms1" onclick="closeDialog();">close</button>
		`;

		unorder_list.classList.add("mdc-list", "mdc-list--two-line", "location-list");
		header_description.classList.add("card-subtitle");
		dialog_box_content.appendChild(header_description);
		dialog_box_content.appendChild(unorder_list);
		
		for (var i=0; i<=location_data.length-1; i++){
			let output_html = `
			<li class="mdc-list-item mdc-list--icon-list">
				<span class="mdc-list-item__ripple"></span>
				<span class="material-icons" style="display:flex;align-items:center; margin:8px">location_on</span>
				<span class="mdc-list-item__text">
					<span class="mdc-list-item__primary-text">${location_data[i].location_name}</span>
					<span class="mdc-list-item__secondary-text landmark1">${location_data[i].landmarks[0]}</span>
					<span class="mdc-list-item__secondary-text landmark2">${location_data[i].landmarks[1]}</span>
				</span>
			</li>
			<li role="separator" style="padding:8px 0px;" class="mdc-list-divider"></li>`;	
			document.querySelector(".location-list").innerHTML +=  output_html;
		}
		var landmark2 = document.querySelectorAll(".landmark2");
		for(let i=0;i< landmark2.length;i++){
			if(  landmark2[i].innerText == 'undefined' || landmark2[i].innerText == null || landmark2[i].innerText == ''){
				landmark2[i].style.display = "none";
			}
		}
	}
	
	//--------- Rating dialog boxes ----------------//
	if(dialog_box_name.includes('rating')){
		dialog_box_header.innerHTML =
		`<h2 class="mdc-dialog__title">Rating</h2>
		<button class="mdc-icon-button material-icons mdc-dialog__close close-rating-dialog" data-mdc-dialog-action="close" onclick='closeRatingDialog("${form_name}")'>close</button>`;

		dialog_box_content.innerHTML = ratingHtml(form_name);

		floatingLabel();
		dialog_box_content.setAttribute('style', 'background-color: #eee; padding: 0px');
		
		let dialog_box_close_btn = document.querySelector(".dialog-box-close-btn");
		dialog_box_close_btn.style.display = "none";
		let feedback_msg = document.ratingForm.feedbackMsg;
		
		feedback_msg.addEventListener('input', (event)=>{
			feedback_msg.value = event.target.value;
			document.querySelector('.rating-sub-btn').setAttribute('onclick', `submitRating("${form_name}","${feedback_msg.value}")`);
		});
		document.querySelector('.rating-sub-btn').setAttribute('onclick', `submitRating("${form_name}","${feedback_msg.value}")`);

		if(rating_version == "v1.0") {
			let rating_text_field = document.querySelector(".rating-input-field");
			rating_text_field != null ? rating_text_field.style.display="none" : rating_text_field.style.display="block";
		}
		if(dialog_box_name == "star-rating"){ starRatingHtml() };
	}
}

// This function closes the dialog box
function closeDialog(){
	let Dialog = document.querySelectorAll('.mdc-dialog');
	for(let i=0;i< Dialog.length;i++){
		Dialog[i].classList.remove('mdc-dialog--open');
	}
}

// This function closes the Rating dialog box and connect to wifi
function closeRatingDialog(form){
	let Dialog = document.querySelectorAll('.mdc-dialog');
	for(let i=0;i< Dialog.length;i++){
		Dialog[i].classList.remove('mdc-dialog--open');
	}
	if(form != "Home") {
		document.forms[form].submit();
	}
}

// This function is to show content of active tab.
function switchingTab(){
	var tabBar = new mdc.tabBar.MDCTabBar(document.querySelector('.mdc-tab-bar'));
	var contentEls = document.querySelectorAll('.content');
	tabBar.listen('MDCTabBar:activated', (event)=> {
		// Hide currently-active content
		document.querySelector('.content--active').classList.remove('content--active');
		// Show content for newly-activated tab
		contentEls[event.detail.index].classList.add('content--active');
	});
}

// This function is for the select rating chips
function chipContent(issue_tags_arr){
	document.querySelector(".rating-message-text").style.display = "none";
	issue_tags_arr.push({key:"others", text:"Others"});
	
	let chip_content_element = document.querySelector(".chip-container");
	issue_tags_arr.forEach((obj, index)=> {
		output = `
			<div class="mdc-chip-set mdc-chip-set--filter" role="grid">
				<div class="mdc-chip" role="row"" style="background-color: #ffa000;">
					<div class="mdc-chip__ripple"></div>
					<span class="mdc-chip__checkmark" >
						<svg class="mdc-chip__checkmark-svg" viewBox="-2 -3 30 30">
							<path class="mdc-chip__checkmark-path" fill="none" stroke="black" d="M1.73,12.91 8.1,19.28 22.79,4.59"/>
						</svg>
					</span>
					<span role="gridcell">
						<span role="checkbox" tabindex="0" aria-checked="false" class="mdc-chip__text">${obj.text}</span>
					</span>
				</div>
			</div>`
		chip_content_element.innerHTML += output;
	});
	
	document.querySelectorAll('.mdc-chip-set').forEach((ele) => {
		const chipSet = new mdc.chips.MDCChipSet(ele);
	});

	let chips = document.querySelectorAll(".mdc-chip");
	let selected_chip_arr = [];
	for(let chip of chips){
		chip.addEventListener('click', ()=>{
			let selected_chips = document.querySelectorAll(".mdc-chip");
			for(let selected_chip of selected_chips){
				var selected_text = selected_chip.querySelector(".mdc-chip__text").innerText;
				if(selected_chip.classList.contains("mdc-chip--selected")){
					if(!selected_chip_arr.includes(selected_text) && selected_text != "Others"){
						selected_chip_arr.push(selected_text);
					}
					if(selected_text == "Others"){
						document.querySelector(".rating-message-text").style.display = "block";
					}
				}
				else if(!selected_chip.classList.contains("mdc-chip--selected")){
					if(selected_text == "Others"){
						document.querySelector(".rating-message-text").style.display = "none";
					}
					else if(selected_chip_arr.includes(selected_text)){
						let index = selected_chip_arr.indexOf(String(selected_text));
						selected_chip_arr.splice(index,1);
					}

				}
			}
			console.log(selected_chip_arr);
		});
	}
}

// This function is for return faq list.
function faqQuetions(project_id){
	let faq_qns_ans = [
		{
			question: "How to connect with a mobile number?", 
			answer: { description: "To connect to the internet at a GMR FREE WIFI hotspot, all you need is a Wi-Fi enabled device with a supporting browser",
					  process: [
						"Enable Wi-Fi and select GMR FREE WIFI SSID.",
						"Open the captive portal on your device.",
						"Click on the click here to login button it will redirect to the login page.",
						"Enter your Indian mobile number and click on GET OTP button.",
						"Enter received OTP and click on CONNECT button.",
						"Your device is connected to the internet and redirected to the google homepage or status page."
					  ]
					},
		},
		{
			question: "How to connect with a coupon code?", 
			answer: { description: "To connect to the internet at a GMR FREE WIFI hotspot, all you need is a Wi-Fi enabled device with a supporting browser",
					  process: [
						"Enable Wi-Fi and select GMR FREE WIFI SSID.",
						"Open the captive portal on your device.",
						"Click on the click here to login button it will redirect to the login page.",
						"Click on the coupon login tab.",
						"Enter your KYC id and coupon code",
						"Click on connect button.",
						"Your device is connected to the internet and redirected to the google homepage or status page."
					  ]
					},
		},
		{
			question: "How to get coupon code from help desk?", 
			answer: { description: "",
					  process: [
						"Please visit the nearest help desk",
						"Submit your KYC documents.",
						"Get a coupon from the help desk.",
						"In the printed Coupon have a KYCID and COUPON CODE"
					  ]
					},
		},
		
		{
			question: "How many devices can i connect in the same session?", 
			answer: { description: "You will connect 3 devices in the same session.",
					  process: []
					},
		},
		{
			question: "I have not received the OTP?", 
			answer: 
			{ description: "",
				process: [
				"Please check your entered mobile number.",
				"Please wait until RESEND OTP button is enabled.",
				"Click on the RESEND OTP button.",
				"Enter only Indian Mobile Number"

				]
			},
		},

	];
	
	if(project_id == "igidel-free-wifi") {
		let kiosk_use = [{
			question: "How to get coupon code from kiosk?", 
			answer: { description: "",
					  process: [
						"Please visit the nearest KIOSK Machine",
						"Place your passport on the kiosk Machine scanner",
						"After scanning is completed, then get a coupon printout.",
						"In the printed Coupon have a KYCID and COUPON CODE."
					  ]
					},
		}];
		faq_qns_ans = faq_qns_ans.concat(kiosk_use);
	}
	faqContent(faq_qns_ans);
}

// This function is to show faqs in the page
function faqContent(faq_qns_ans){
	const faq_container = document.querySelector('.faq-content');
	for(let res of faq_qns_ans){
		var steps = "";
		var process = res.answer.process.toString().split(",");
		for(let step of process){
			if(step != "") steps += `<li style="margin: 8px 0px;">${step}</li>`;
		}
		let output = `
			<button class="collapsible-header">
				<span class="collapsible-header-text text-justify">${res.question}</span><span class="material-icons mdc-icon faq-arrow">arrow_right</span>
			</button>
			<div>
				<div class="collapsible-content">
					<p class="card-subtitle faq-description text-justify">${res.answer.description}</p>
					<div class= "faq-steps">
						<ul class= "faq-steps-process-1 text-justify">
							${steps}
						</ul>
					</div>
				</div>
			</div>`;
		faq_container.innerHTML += output;
	}
}

// This function is to expand and collapse faqs.
function expandAndCollapseFaqs(){
	const collapsibles = document.querySelectorAll(".collapsible-header");
	let lastActiveCollapsibleBody = null;

	function expand(el, arrow) {
		if (lastActiveCollapsibleBody) {
			unexpand(lastActiveCollapsibleBody, arrow);
		}
		el.style.maxHeight = el.scrollHeight + "px";
		el.classList.add("active");
		arrow.classList.add("faq-arrow-rotate");
		lastActiveCollapsibleBody = el;
	}

	function unexpand(el, arrow) {
		el.style.maxHeight = null;
		el.classList.remove("active");
		arrow.classList.remove("faq-arrow-rotate");
	}

	collapsibles.forEach((collapsible) => {
		const collapsibleBody = collapsible.nextElementSibling;
		let colapsable_arrow = collapsible.querySelector(".faq-arrow");
		if (collapsibleBody.classList.contains("active")) {
			expand(collapsibleBody, colapsable_arrow);
		}
		collapsible.addEventListener("click", function () {
			if (collapsibleBody.style.maxHeight) {
				unexpand(collapsibleBody, colapsable_arrow);
			} 
			else {
				expand(collapsibleBody, colapsable_arrow);
			}
		});
	});
}

// THis function is to load faqs after page load
function loadFaqTemplate(project_id){
	window.addEventListener("load", async (event) => {
		faqQuetions(project_id);
		expandAndCollapseFaqs();
	});
}

// This function is to show termas and conditions in page based on the project name.
function termsConditions(project_id) {
	let terms_container = document.querySelectorAll(".terms-privacy-container");
	if(terms_container != null) {
		for(let terms of terms_container) {
			if(project_id == "igidel-free-wifi") {
				terms.innerHTML = `
					<p class="">By connecting, you agree to our <a href="#" onclick="return openDialog('privacy_policy')"> Privacy Policy</a> and <a href="#" onclick="return openDialog('terms_coditions');" id="termsConditionsBtn"> Terms and Conditions</a>, including Cookie Use. You may receive a text with verification code - standard text messaging rates may apply</p>
				`;
			}
		}
	}
}

// This function is to change page bottom help text based on project name.
function userHelpText(project_id) {
	let user_help_text_ele = document.querySelector(".user-help-text");
	if(user_help_text_ele != null) {
		if(project_id == "igidel-free-wifi") {
			user_help_text_ele.innerHTML = `
				<p>In case of any difficulty in getting verification code or internet access, please contact the <a href="#" onclick="openDialog('kiosk');" >information kiosk</a> or contact <a href="#" onclick="openDialog('helpdesk');">Help desk</a>.</p>
			`;
		}
		else if(project_id == "goa-airport") {
			user_help_text_ele.innerHTML = `
				<p>In case of any difficulty in getting verification code or internet access, please contact Help desk.</p>
			`;
		}
		else if(project_id == "igidel-encalm-lounge" || project_id == "igidel-encalm-spa-lounge" || project_id == "igidel-encalm-vip-lounge") {
			user_help_text_ele.innerHTML = `
				<p>In case of any difficulty in getting verification code, internet access or any further assistance, please contact <a href='tel:8448995655'>  +918448995655</a>.</p>
			`;
		} 
		else if(project_id == "igidel-airindia-lounge" || project_id == "igidel-amex-lounge" || project_id == "transit-hotel-wifi") {
			let user_help_text_container = document.querySelector(".user-help-text-container");
			if(user_help_text_container != null) {
				user_help_text_container.style.display = "none";
			}
		}
	}
}

// This function is to set primay color to the element based on the config file.
function setPrimaryColor(color, bg_color) {
	let primary_color_elements = document.querySelectorAll(".primary-color");
	if(primary_color_elements != null) {
		for (const primary_color_element of primary_color_elements) {
			primary_color_element.style.setProperty('background-color', bg_color);
			primary_color_element.style.setProperty('color', color);
		}
	}
}

// This function is to set secondary color to the element based on the config file.
function setSecondaryColor(color, bg_color) {
	let secondary_color_elements = document.querySelectorAll(".secondary-color");
	if(secondary_color_elements != null) {
		for (const secondary_color_element of secondary_color_elements) {
			secondary_color_element.style.setProperty('background-color', bg_color);
			secondary_color_element.style.setProperty('color', color);
		}
	}
}

// This function is to set the project name based on config file
function setProjectName(proj_name) {
	var project_name = document.querySelector('.project-name');
	if(project_name != null) {
		project_name.innerText += " " + proj_name;
	}
}

// This function is to set primary button background color and color based on config file.
function setPrimaryBtn(color, bg_color) {
	let primary_btn_elements = document.querySelectorAll(".primary-btn-element");
	if(primary_btn_elements != null) {
		for(const primary_btn of primary_btn_elements) {
			primary_btn.style.setProperty('background-color',  bg_color);
			primary_btn.style.setProperty('color', color);
		}
	}
}

// This function is to set secondary button background color and color based on config file.
function setSecondaryBtn(color, bg_color) {
	let secondary_btn_elements = document.querySelectorAll(".secondary-btn-element");
	if(secondary_btn_elements != null) {
		for(const secondary_btn of secondary_btn_elements) {
			secondary_btn.style.setProperty('background-color', bg_color);
			secondary_btn.style.setProperty('color', color);
		}
	}
}

// This Function for the load common ui in all pages according to their project Json file
async  function loadPage(pageName = "") {
	let props = null;
	try {
		 props = await asyncGetJsonData();
		 button_disable_obj =  {
			color: props?.button_disabled_color,
			bg_color: props?.button_disabled_bg_color
		}
		btn_enable_obj = {
			primary_color: props?.primary_btn_color,
			primary_bg_color: props?.primary_btn_bg_color,
			secondary_color: props?.secondary_btn_color,
			secondary_bg_color: props?.secondary_btn_bg_color
		}
		rating_version = props?.rating_version;

		setHeader(props.logo, props.project_name, props?.ui_project_id, props.logo_position);
		setFooter(props.ui_project_id, props.transmedia_logo, props.transmedia_logo_visible);
		setMainContainerHeight(props?.ui_project_id);
		
		showHideAdvBanners(props.enable_top_advertisement_banner, props.enable_main_advertisement_banner, props.banner, props.full_banner, props?.ui_project_id);
		setPrimaryColor(props.primary_color, props.primary_bg_color);
		setSecondaryColor(props.secondary_color, props.secondary_bg_color);
		
		setPrimaryBtn(props.primary_btn_color, props.primary_btn_bg_color);
		setSecondaryBtn(props.secondary_btn_color, props.secondary_btn_bg_color);
		showRequiredLoginTabs(props?.login_type)

		if(pageName == "signin") {
			loadSignin();
			switchingTab();
			if(props?.login_type.toString().includes("room_login")) {
				loadRoomLogin();
			}
			if(props?.login_type.toString().includes("coupon_login")) {
				loadCouponLogin();
			}
			if(props?.login_type.toString().includes("mobile_login")) {
				loadMobileLogin()
			}
			setProjectName(props.project_name);
			termsConditions(props?.ui_project_id);
			LoginNotes(props?.ui_project_id);
			userHelpText(props?.ui_project_id);
			signinPageTabs(props.domestic_login, props.international_login);
			faqContentInpage(props.faq_required, props.enable_faq_content, props?.ui_project_id);
			displayFaqlink(props.faq_required);
		}
		else if(pageName == "status") {
			logedinSessionTime();
		}
	}
	catch (err) {
		pageLoadErrorHandling();
		alert("Something went wrong in load page " + err); 
	}
}

try {
	loadPage(page_name);
}
catch (err) {
	alert("Something Went Wrong in load page." + err);
}