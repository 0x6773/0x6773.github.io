// Remove below comment for goa airport assets
// var myRequestPath = "./assets/js/goa_airport.json";

// Remove below comment for delhi airport assets
 var myRequestPath = "./assets/js/delhi_airport.json";
// var myRequestPath = "./assets/js/Encalm/encalm_prive.json";
// var myRequestPath = "./assets/js/Encalm/encalm_lounge.json";
// var myRequestPath = "./assets/js/Encalm/encalm_SPA.json";
// var myRequestPath = "./assets/js/air_india.json";
// var myRequestPath = "./assets/js/amex.json";

var myRequest = new Request(myRequestPath);
let project = null;
function load() {
    if (project == null) {
        return new Promise(resolve => {
            fetch(myRequest).
            then(function(resp){
                project = resp.json();
                resolve(project);
            });
        });
    } 
    return project;
}

// async function load() {
//     if(project == null) {
//         try {
//             const resp = await fetch(myRequest);
//             project = resp.json();
//         }
//         catch(err) {
//             alert(err + " In config file load function");
//         }
//     }
//     return project;
// }

async function asyncGetJsonData() {
    if(project == null) {
        project = await load();
    }
    return project;
}

function getJsonData(){
    let response_obj  = null;
	const xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", myRequestPath, false);
	xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            response_obj = JSON.parse(xmlhttp.responseText);
        }
        else {
            alert("Something went wrong in getJsonData" + xmlhttp.status);
        }
    };
    xmlhttp.send();
    return response_obj;
}