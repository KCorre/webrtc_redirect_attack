(function(global) {
  "use strict";

 function IDPJS() {
    this.domain = window.location.host;
    console.log("Debug Idp Proxy doamin",this.domain);
    // so rather than create a million different IdP configurations and litter
    // the world with files all containing near-identical code, let's use the
    // hash/URL fragment as a way of generating instructions for the IdP
    this.instructions = window.location.hash.replace("#", "").split(":");
    console.log("Debug Idp Proxy hash: ",this.instructions);
    // so rather than create a million different IdP configurations and litter
    this.port = window.rtcwebIdentityPort;
    console.log("Debug Idp Proxy port: %o",this.port);
    //bind onmessage
    this.port.onmessage = this.receiveMessage.bind(this);
    console.log("Debug Idp Proxy is READY to process requests.");
    this.sendResponse({
      type : "READY"
    });
  }

  IDPJS.prototype.getDelay = function() {
    // instructions in the form "delay123" have that many milliseconds
    // added before sending the response
    var delay = 0;
    function addDelay(instruction) {
      var m = instruction.match(/^delay(\d+)$/);
      if (m) {
        delay += parseInt(m[1], 10);
      }
    }
    this.instructions.forEach(addDelay);
    return delay;
  };

  function is(target) {
    return function(instruction) {
      return instruction === target;
    };
  }

  IDPJS.prototype.sendResponse = function(response) {
    // we don't touch the READY message unless told to
    if (response.type === "READY" && !this.instructions.some(is("ready"))) {
      console.log("Debug Response Sent from the IdP Proxy: "+JSON.stringify(response));
      this.port.postMessage(response);
      return;
    }

    // if any instruction is "error", return an error.
    if (this.instructions.some(is("error"))) {
      response.type = "ERROR";
    }

    window.setTimeout(function() {
      this.port.postMessage(response);
    }.bind(this), this.getDelay());
  };

  IDPJS.prototype.receiveMessage = function(ev) {
    console.log("Debug Event received by IdP Proxy: %o",ev.data);
    var message = ev.data;
    switch (message.type) {
    case "SIGN":
      var formData = new FormData();
      formData.append("contents", message.message);
      var xmlhttp = new XMLHttpRequest();
      console.log("Debug msg to sign: "+message.message);
      var request = new XMLHttpRequest();
      var jws2;
      //async response
      request.onreadystatechange=function(){
        if (request.readyState==4 && request.status==200){
          try {
            var response=request.responseXML;
            //console.dir(response.getElementById("jws").textContent);
           var jwselement=response.getElementById("jws");
          }catch(err) {
            console.dir(err);
          }
	  if(jwselement){
            jws=jwselement.textContent;
          }else {
            try{
              var SAMLResponse=response.getElementsByName("SAMLResponse")[0].value;
              console.log("Debug SAMLResponse: "+SAMLResponse);
              var RelayState=response.getElementsByName("RelayState")[0].value;
              console.log("Debug RelayState: "+RelayState);
              var SAMLPostURL=response.getElementsByTagName("form")[0].action;
              console.log("Debug SAML Post URL: "+SAMLPostURL);
              var formElement = response.getElementsByTagName("form")[0];
            }catch(err){
	      //TBD better error handling
              console.log("Error: Couldn't parse response2 from IdP!")
              this.sendResponse({
                type : "ERROR",
                error : "empty response from IdP!"
              });	
            }
            var formData2 ="SAMLResponse="+encodeURIComponent(SAMLResponse)+"&RelayState="+encodeURIComponent(RelayState);
            var request2 = new XMLHttpRequest();
            request2.onreadystatechange=function(){
              if (request2.readyState==4 && request2.status==200){
                var response2=request2.responseXML;
       	        var jwselement2=response2.getElementById("jws");
                if(jwselement2){
                  jws2=jwselement2.textContent;
                }else {
                  //TBD better error handling
                  console.log("Error: JWS not found in response2 from IdP !")
                }
                if(jws2){
                  console.log("Debug JWS2: "+jws);
                  this.sendResponse({
                    type : "SUCCESS",
                    id : message.id,
                    message : {
                      idp : {
                        domain : this.domain,
                        protocol : "idp.html"
                      }, 
                      assertion : jws2
                    }
                  });
                } else {
                  //TBD better error handling
                  console.log("Error: empty response from IdP!")
                  this.sendResponse({
                    type : "ERROR",
                    error : "empty response from IdP!"
                  });              
                }
              }
            }.bind(this);
            request2.open('POST',SAMLPostURL,true);
            request2.setRequestHeader("Content-type","application/x-www-form-urlencoded");
      	    request2.responseType = "document";
	    request2.withCredentials = true;
      	    request2.send(formData2);
          }
          if(jws){
            console.log("Debug JWS: "+jws);
           this.sendResponse({
              type : "SUCCESS",
              id : message.id,
              message : {
                idp : {
                  domain : this.domain,
                  protocol : "idp.html"
                }, 
                assertion : jws
              }
            });
	  }
       }
      }.bind(this);

      request.open('POST',"https://niif.hu/.well-known/sp/jws.php",true);
      request.responseType = "document";
      request.withCredentials = true;
      console.log("Debug The json, which will be sent to IdP for sign: "+JSON.stringify(message.message));
      request.send(formData);
      break;
    case "VERIFY":

      var sJWS = message.message;
      console.log("Debug JWT for verification:"+sJWS);
      var xmlhttp = new XMLHttpRequest();
      xmlhttp.open("GET","https://niif.hu/.well-known/idp-proxy/saml.crt",false);
      xmlhttp.send();
      var sCert=xmlhttp.responseText;
 
      var jws =  new KJUR.jws.JWS; 
      var result = 0;
      try {
        result = KJUR.jws.JWS.verify(sJWS, sCert);
        jws.parseJWS(sJWS,false);
      } catch (ex) {
        console.log("Debug JWT parsing/signature Error: " + ex);
        result = 0;
      }
  
      var parsedMessage=JSON.parse(jws.parsedJWS.payloadS);
      if (result == 1) {
   	console.log("Debug JWS signature is *Valid*.");
	console.log("Debug success msg to js application"+JSON.stringify({
	  type : "SUCCESS",
	  id : message.id,
	  message : parsedMessage
	}));

        this.sendResponse({
          type : "SUCCESS",
          id : message.id,
          message : {identity: parsedMessage.identity, contents: JSON.stringify(parsedMessage.contents) }
        });
      } else {
        console.log("Debug JWS signature is *Invalid*.");

	this.sendResponse({
		type : "ERROR",
		error : "JWS signature is *Invalid*."
	});
      }
      break;
    default:
      this.sendResponse({
        type : "ERROR",
        error : JSON.stringify(message)
      });
      break;
    }
  };

  global.idp = new IDPJS();
}(this));
