var  error_type = "is-invalid";
let projectJsonValue = null;

try {
	projectJsonValue = getJsonData();
}
catch(err) {
	alert("Something went wrong in getting JSON data in api.js " + err);
	pageLoadErrorHandling();
}
function getBaseUrl() {
	let temp_base_url = null;
	if(projectJsonValue != null || projectJsonValue != undefined  || projectJsonValue != "") {
		if(projectJsonValue?.base_url != undefined) {
			temp_base_url =  projectJsonValue?.base_url;
		}
		else {
			alert("Getting base url is undefined");
		}
	} 
	else {
		alert("Getting Base url is null");
	}
	return temp_base_url;
}

let baseURL = getBaseUrl();
let projectId  = projectJsonValue?.project_id;

const usernameAPI = baseURL + "/username";
const otpAPI = baseURL+"/otp";
const registerAPI = baseURL+"/register";
const forgotAPI = baseURL + "/forgot";
const couponApi = baseURL != null ? baseURL.replace("/hotspot", "") + "/coupon": alert("Getting base url is null");
const authApi = baseURL + "/auth";
const ratingApi = baseURL + '/rate';

button_disable_obj = {
	color: projectJsonValue?.button_disabled_color,
	bg_color: projectJsonValue?.button_disabled_bg_color
}
btn_enable_obj =  {
	primary_color: projectJsonValue?.primary_btn_color,
	primary_bg_color: projectJsonValue?.primary_btn_bg_color,
	secondary_color: projectJsonValue?.secondary_btn_color,
	secondary_bg_color: projectJsonValue?.secondary_btn_bg_color
}

function loginWithOtp() {
    let mobile = document.signin.mobile;
	let username = document.signin.username;
    let otp = document.signin.password;
	let ip = document.signin.ip.value;
	let mac = document.signin.mac.value;
	let dst = document.signin.dst;

	let mobile_status = false;
	let otp_status = false;

	let button_name = "signinBtn";
	let button_progress = "signinBtnProgress";

	mobile_status = validateMobile(mobile.value, error_type);
	otp_status = validateOtp(otp.value, error_type);

	if(mobile_status == true && otp_status == true) {
		buttonDisable(button_name, button_disable_obj);
		linerProressBar(button_progress, true);
		var button_obj = {
			button_name: button_name,
			button_progress: button_progress,
			button_type: "primary"
		}
		var response_obj = {
			request_type : "validate_otp",
			response_status : null,
			response_text : null,
		}
		const Http = new XMLHttpRequest();
		let otp_data =  {
			"username": "91" + mobile.value,
			"otp": otp.value,
			"ip": ip,
			"mac": mac,
			"project": projectId
		}
		if(projectId == "goa-airport") {
			delete otp_data.project;
		}
		Http.open("POST", registerAPI, true);
		Http.setRequestHeader("Content-type", "application/json");
		Http.send(JSON.stringify(otp_data));
		Http.onload = () => {
			var response_obj = {
				request_type : "validate_otp",
				response_status : Http.status,
				response_text : Http.responseText,
			}
			var response_status = registerStatus(response_obj, button_obj, ip, mac);
			if(response_status == true) {
				// Making rating api request for returned users
				stopCount();
				linerProressBar("signinBtnProgress", true);
				if(Http.responseText == "Successfully registered") {
					username.value = "91"+mobile.value;
					document.signin.submit();
				}
				else {
					var response_obj = JSON.parse(Http.responseText);
					username.value = response_obj.response.username ;
					otp.value = response_obj.response.password;
					if(response_obj.response.dst != null && response_obj.response.dst != "" && response_obj.response.dst != undefined) {
						dst.value = response_obj.response.dst;
					}
					if(response_obj.response.is_rating_required == true){
						openDialog("star-rating", "signin");
					}
					else {
						document.signin.submit();
					}
				}
			}
		}
		httpRequestError(Http, (val) => {
			response_obj.response_text = val;
			registerStatus(response_obj, button_obj);
		});
	}
}

function RedeemCoupon(){
	var kyc = document.couponForm.password;
	var coupon = document.couponForm.username;
	var ip = document.couponForm.ip.value;
	var mac = document.couponForm.mac.value;
	var dst = document.couponForm.dst;

	let coupon_status = ValidateCoupon(coupon.value, error_type);
	let kyc_status = ValidateKyc(kyc.value, error_type);

	var button_obj = {
		button_name: "ReedemCouponBtn",
		button_progress: "ReedemCouponBtnProgress",
		button_type: "primary"
	}
	var response_obj = {
		request_type : "validate_coupon",
		response_status :null,
		response_text :null,
	}

    if(coupon_status == true && kyc_status == true) {
		// Making coupon Api request for the validate coupon
		buttonDisable(button_obj.button_name, button_disable_obj);
		linerProressBar(button_obj.button_progress, true);
		const Http = new XMLHttpRequest();
		const coupon_api = couponApi+"/"+coupon.value;
		Http.open("GET", coupon_api, true);
		Http.send();
		Http.onload = () => {
			response_obj.request_type = "validate_coupon";
			response_obj.response_status = Http.status;
			response_obj.response_text = Http.responseText;
			var response_status = registerStatus(response_obj, button_obj, ip, mac);
			if(response_status == true) {
				if(projectId == "igidel-free-wifi") {
					const AuthHttp = new XMLHttpRequest();
					const url = authApi;
					AuthHttp.open("POST", url, true);
					AuthHttp.setRequestHeader("Content-type", "application/json");
					var jsonData = {
						"username": coupon.value,
						"password": kyc.value,
						"ip": ip,
						"mac": mac,
						"project": projectId
					};
					AuthHttp.send(JSON.stringify(jsonData));
					AuthHttp.onload = () => {
						response_obj.request_type = "auth_coupon";
						response_obj.response_status = AuthHttp.status;
						response_obj.response_text = AuthHttp.responseText;
						
						var auth_response_status = registerStatus(response_obj, button_obj, ip, mac);
						// Making rating api request for taking rating from coupon login users
						if(auth_response_status == true) {
							var auth_response_obj = JSON.parse(AuthHttp.responseText);
							coupon.value = auth_response_obj.response.username;
							kyc.value = auth_response_obj.response.password;
							if(auth_response_obj.response.dst != null && auth_response_obj.response.dst != "" && auth_response_obj.response.dst != undefined) {
								dst.value = auth_response_obj.response.dst;
							}
							if(auth_response_obj.response.is_rating_required == true ){
								// use parameters "star-rating", "smily-rating", "rating-like-dislike", "smily-rating-1"
								openDialog("star-rating", "couponForm");
							}
							else {
								document.couponForm.submit();
							}
						}
					}
					httpRequestError(AuthHttp, (val)=> {
						response_obj.response_text = val;
						registerStatus(response_obj, button_obj);
					});
				}
				else {	
					document.couponForm.submit();
				}
			}
		}
		httpRequestError(Http, (val)=> {
			response_obj.response_text = val;
			registerStatus(response_obj, button_obj);
		});
	}
}

// This function is for making generate otp api request
function generateOtp(username, ip, mac, callback) {
	const http_getotp = new XMLHttpRequest();
	const getotp_api = otpAPI;
	http_getotp.open("POST", getotp_api,true);
	http_getotp.setRequestHeader("Content-type", "application/json");
	var jsonData = {
		"ip": ip,
		"mac": mac,
		"username": username,
		"project": projectId
	};
	if(projectId == "goa-airport") {
		delete jsonData.project;
	}
	http_getotp.send(JSON.stringify(jsonData));
	var getotp_response = {
		"status_code": http_getotp.status,
		"response_text": http_getotp.responseText
	}
	http_getotp.onload = () => {
		getotp_response.status_code = http_getotp.status;
		getotp_response.response_text = http_getotp.responseText;
		callback(getotp_response);
	}
	httpRequestError(http_getotp, (val)=> {
		getotp_response.response_text = val;
		callback(getotp_response);
	});
}

// This function is for making validate Username api request
function validateUsername(user, ip , mac, Callback) {
	const http_validateUser = new XMLHttpRequest();
	const validateUser_api = usernameAPI;
	http_validateUser.open("POST", validateUser_api, true);
	http_validateUser.setRequestHeader("Content-type", "application/json");
	var jsonData = {
		"ip": ip,
		"mac": mac,
		"username": user
	};
	http_validateUser.send(JSON.stringify(jsonData));
	var validateUser_response = {
		"status_code": http_validateUser.status,
		"response_text": http_validateUser.responseText
	}
	http_validateUser.onload = ()=>{
		validateUser_response.status_code =  http_validateUser.status;
		validateUser_response.response_text = http_validateUser.responseText;
		Callback(validateUser_response);
	}
	httpRequestError(http_validateUser, (val)=> {
		validateUser_response.response_text = val;
		Callback(validateUser_response);
	});
}

// This function is for calling validate username function, generate otp function and making validate otp request.
function formGenerateOtp(form = "") {
	let form_name = form, button_name, button_progress, validate_username = true, generate_btn_type = 'primary', username_type, otp_type = "generate_otp";
	if(form_name == 'signin') {
		button_name = 'signinGenerateBtn';
		button_progress = 'signinGenerateProgress';
		validate_username = false;
		generate_btn_type = 'secondary';
		otp_type = 'signin_otp';
	}
	if(form_name != null){
		let mobile = document.forms[form_name].mobile.value;
		let ip = document.forms[form_name].ip.value;
		let mac = document.forms[form_name].mac.value;
		let mobile_status = true;
		mobile_status = validateMobile(mobile, error_type)

		if(mobile_status) {
			buttonDisable(button_name, button_disable_obj);
			linerProressBar(button_progress, true );
			let button_obj = {
				button_name: button_name,
				button_progress: button_progress,
				button_type: generate_btn_type
			}

			function generateOtpStatus() {
				generateOtp("91"+mobile, ip, mac, (otp_response)=>{
					var getotp_response = otp_response;
					var response_obj = {
						request_type : otp_type,
						response_status : getotp_response.status_code,
						response_text : getotp_response.response_text,
					}
					var otp_response_status = registerStatus(response_obj, button_obj, ip, mac);
					
					if(otp_response_status == true) {
						let afterOtp = document.querySelectorAll('.after-otp-section');
						for(let i = 0; i < afterOtp.length; i++) {
							afterOtp[i].style.display = "block";
						};
						startCount("otp-api-response");
					}
				});
			}
			if(validate_username == true){
				let username_response_status = false;
				validateUsername("91"+mobile, ip, mac, (username_respomse) =>{
					var validate_username_response = username_respomse;
					var response_obj = {
						request_type : username_type,
						response_status : validate_username_response.status_code,
						response_text : validate_username_response.response_text,
					}
					username_response_status = registerStatus(response_obj, button_obj, ip, mac);
					if(username_response_status == true) {	
						linerProressBar(button_progress, true );
						generateOtpStatus();
					}
				});
			}
			else {
				linerProressBar(button_progress, true );
				generateOtpStatus();
			}
		}
	}
}

// taking rating value//
var rating_value = null;
function StarRatingValue(){
	const stars = document.querySelectorAll('.stars i');
	// ---- ---- Stars ---- ---- //
	stars.forEach((star, index1) => {
		star.addEventListener('click', () => {
			stars.forEach((star, index2) => {
				if(index1 == index2){
					document.querySelector(".rating-api-response").innerText = "";
					rating_value = index2+1;
				}
				// ---- ---- Active Star ---- ---- //
				index1 >= index2? star.classList.add('active'): star.classList.remove('active');
			});
		});
	});
	return rating_value;
}

function submitRating(form_name="", feedbackMsg=""){

	let username, ip, mac, page;
	let rating_selected = true;
	var rating_response_ele = document.querySelector(".rating-api-response");

	if(form_name == "signin"){
		username = "91"+document.signin.mobile.value;
		ip = document.signin.ip.value;
		mac = document.signin.mac.value;
		page = "login"; 

		buttonEnable("signinBtn", "primary", btn_enable_obj);
		linerProressBar("signinBtnProgress", false);
	}
	else if(form_name == "couponForm"){
		username = document.couponForm.username.value;
		ip = document.couponForm.ip.value;
		mac = document.couponForm.mac.value;
		page = "coupon";

		buttonEnable("ReedemCouponBtn", "primary", btn_enable_obj);
		linerProressBar("ReedemCouponBtnProgress", false);
	}

	if(rating_value == null){
		rating_response_ele.innerText = "Please provide your valuable feedback.";
		rating_selected = false;
	}
	else {
		rating_response_ele.innerText = "";
		buttonDisable("rating-sub-btn", button_disable_obj);
		linerProressBar("star-Rating-Btn-Progress", true);
		const Http = new XMLHttpRequest();
		const ratingUrl = ratingApi;
		Http.open("POST", ratingUrl, true);
		Http.setRequestHeader("Content-type", "application/json");
		var jsonData = {
			"username": username,
			"ip": ip,
			"mac": mac,
			"rating": rating_value,
			"screen_name":page,
			"feedback": feedbackMsg,
			"project": projectId
		};
		Http.send(JSON.stringify(jsonData));
		Http.onload = ()=>{
			var response_obj = {
				request_type : "validate_rating",
				response_status : Http.status,
				response_text : Http.responseText,
			};
			var button_obj = {
				button_name: "rating-sub-btn",
				button_progress: "star-Rating-Btn-Progress",
				button_type: "primary"
			};
			var response_status = registerStatus(response_obj, button_obj, ip, mac);
			if(response_status == true && form_name != "Home") {
				document.forms[form_name].submit();
			}
		}
	}
}
	
function registerStatus( register_status_obj, button_obj, ip, mac) {

	var request_type = register_status_obj.request_type; 
	var response_status = register_status_obj.response_status;
	var response_text = register_status_obj.response_text;

	var button_name = button_obj.button_name;
	var button_progress = button_obj.button_progress;
	var button_type = button_obj.button_type;

	let ip_address = ip;
	let mac_address = mac;

	var register_status_element = document.querySelector(".registerStatus");
	var coupon_api_response_ele = document.querySelector(".coupon-api-response");
	var otp_api_response_ele = document.querySelector(".otp-api-response");
	var rating_api_response_ele = document.querySelector(".rating-api-response");

	var status = true;

	if(button_name != null && button_progress != null) {
		buttonDisable(button_name, button_disable_obj);
		linerProressBar(button_progress, false);
	}

	if(request_type == "validate_coupon" || request_type == "auth_coupon"){
		if(coupon_api_response_ele != null) {
			register_status_element = coupon_api_response_ele;
		}
	}

	else if(request_type == "validate_rating") {
		if(rating_api_response_ele != null) {
			register_status_element = rating_api_response_ele;
		}
	}
	else if(request_type == "signin_otp" || request_type == "validate_otp" ) {
		if(otp_api_response_ele != null) {
			register_status_element = otp_api_response_ele;
		}
	}
	if(register_status_element != null) {
		register_status_element.style.color = "red";
	}
	if(response_text == "Request Timeout"){
		linerProressBar(button_progress, false);
		buttonEnable(button_name, button_type, btn_enable_obj);
		register_status_element.innerText == "Request Timeout, Please try again";
		status = false;
	};
	
	if(response_status == 500) {
		register_status_element.innerText = "Internal Server Error, Please try after sometime";
		status = false;
	}
	else if(response_text.includes("EXCEEDS")) {
		status = false;
		linerProressBar(button_progress, false);
		// Enable primary or secondary button conditionally
		if(button_name == "signinGenerateBtn"){
			buttonEnable("generate","secondary", btn_enable_obj);
		}
		else {
			buttonEnable(button_name, "primary", btn_enable_obj);
		}
		if(response_text.includes("message")) {
			let validate_otp_res_obj = JSON.parse(response_text);
			response_text = validate_otp_res_obj.message;
		}
		if(response_text == "EXCEEDS_TOTAL_API_REQUESTS"){
			register_status_element.innerText = 'Your requests are blocked for an 1 hour due to "Exceeds total api requests". Please contact +91 8448995655 or gmrwifi@transmediagroup.in.';
		}
		else if(response_text == "EXCEEDS_FAILED_OTP_ATTEMPTS") {
			register_status_element.innerText = 'Your requests are blocked for an 1 hour due to "Exceeds total otp attempts". Please contact +91 8448995655 or gmrwifi@transmediagroup.in.';
	
		}
		else if(response_text == "EXCEEDS_TOTAL_OTP_REQUESTS"){
			register_status_element.innerText = 'Your requests are blocked for an 1 hour due to "Exceeds total otp requests". Please contact +91 8448995655 or gmrwifi@transmediagroup.in.';
		}
		else if(response_text == "EXCEEDS_FAILED_LOGIN_ATTEMPTS") {
			register_status_element.innerText = 'Your requests are blocked for an 1 hour due to "Exceeds total login attempts". Please contact +91 8448995655 or gmrwifi@transmediagroup.in.';
		}
		else {
			register_status_element.innerText = response_text;
		}
		if(ip_address != null || ip_address != "") {
			register_status_element.innerText += ` ip: ${ip_address}`;
		}
		if(mac_address != null || mac_address != "") {
			register_status_element.innerText += `  and mac: ${mac_address}.`;
		}
	}
	else if(request_type.includes("signin_otp") && response_status == 200 && !response_text.includes("EXCEEDS")) {
		register_status_element.style.color = "green";
		register_status_element.innerText = "Sucessfully sent the OTP";
	}
	
	else if((request_type == "auth_coupon" ) && response_status == 200 && !response_text.includes("EXCEEDS")){
		var auth_reponse_obj = JSON.parse(response_text);
		var auth_response_msg = auth_reponse_obj.message;
		if(auth_response_msg.includes("Successful")) {
			register_status_element.innerText = "";
		}
		else if(auth_response_msg.includes("Incorrect")) {
			register_status_element.innerText = auth_response_msg;
			buttonEnable(button_name, "primary", btn_enable_obj);
			linerProressBar(button_progress , false)
			status = false;
		}
	}

	else if((request_type == "auth_coupon" ) && response_status == 400){
		var auth_reponse_obj = JSON.parse(response_text);
		var auth_response_msg = auth_reponse_obj.message;
		register_status_element.innerText = auth_response_msg;
		buttonEnable(button_name, "primary", btn_enable_obj);
		linerProressBar(button_progress , false)
		status = false;
	}

	else if(request_type == "validate_otp" && response_status == 400) {
		buttonEnable(button_name, button_type, btn_enable_obj);
		linerProressBar(button_progress);
		if(response_text.includes("message")) {
			let validate_otp_res = JSON.parse(response_text);
			register_status_element.innerText = validate_otp_res.message;
		}
		else {
			register_status_element.innerText = response_text;
		}
		status = false;
	}

	else if((request_type == "validate_rating" || request_type == "validate_coupon" ) && response_status == 400){
		buttonEnable(button_name, button_type, btn_enable_obj);
		linerProressBar(button_progress, false);
		register_status_element.innerText = response_text;
		status = false;
	}
	
	else if(request_type == "validate_rating" && response_status == 200  && response_text.includes("Successfully")) {
		buttonEnable(button_name, button_type, btn_enable_obj);
		linerProressBar(button_progress, false);
		register_status_element.innerText = response_text;
		register_status_element.style.color = "green";
	}

	else if(request_type == "validate_coupon" && response_status == 200 && !response_text.includes("EXCEEDS")){
		if(register_status_element != null) {
			register_status_element.innerText = response_text;
			register_status_element.style.color = "green";
		}
	}

	else if(request_type == "validate_otp" && response_status == 200 && !response_text.includes("EXCEEDS")){
		if(response_text == "Successfully registered"){
			register_status_element.innerText = response_text;
		}
		else {
			let response_obj = JSON.parse(response_text);
			register_status_element.innerText = response_obj.message;
		}
		register_status_element.style.color = "green";
	}
	else {
		register_status_element.innerText = response_text;
		status = false;
	}
	return status;
}

function httpRequestError(request, Callback) { 
	request.addEventListener("error", (event)=> {
		request.abort();
		Callback("Request Timeout");
	});
}