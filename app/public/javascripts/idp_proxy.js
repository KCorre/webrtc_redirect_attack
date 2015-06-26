/*
 * An example IdP Proxy script
 *
 * This would be sourced by the IdP's .well-known/idp-proxy/<proto> file,
 * which itself would be a simple html file like this:
 *
 * <!DOCTYPE html>
 *   <head>
 *     <script src="/proxyscript.js"></script>
 *   </head>
 *   <body></body>
 * </html>
 *
 * where this file is "proxyscript.js"
 *
 * The postResponse function is injected here by the RTCIdentity module
 * in the browser so that we can send messages back to it.  We receive
 * messages in the form of custom events of the type 'idp-request'.
 */

function IDPProxy() {
  // Upon receiving our READY message, the RTC Peer Connection
  // will know it can start sending us messages to sign or verify.
  postResponse({type: "READY"});
}

IDPProxy.prototype = {
  process: function IDPProxy_process(aMessage) {
    var message = aMessage.message;
    dump("got message: " + JSON.stringify(message) + "\n");
    switch (message.type) {
      case "SIGN":
        this.sign(message);
        break;

      case "VERIFY":
        this.verify(message);
        break;
    }
  },

  sign: function IDPProxy_sign(aMessage) {
    var assertion = JSON.stringify({
      origin: aMessage.origin,
      message: aMessage.message,
      identity: "alice@example.org",
      displayname: "Alice",
      request_origin: aMessage.origin
    });

    postResponse({  
      type: "SUCCESS",
      id: aMessage.id,
      message: {
        idp: {
          domain: "example.org",
          protocol: "bogus"
        },
        assertion: assertion
      }
    });
  },

  verify: function IDPProxy_verify(aMessage) {
    var assertion = JSON.parse(aMessage.message);

    postResponse({
      type: "SUCCESS",
      id: aMessage.id,
      message: {
        identity: {
          identity: assertion.identity,
          displayname: assertion.displayname
        },
        request_origin: assertion.request_origin,
        contents: assertion.message
      }
    });
  }
};

function receiveMessage(aEvent) {
  // Events that originate in browser chrome have the property isTrusted:true.
  var detail = JSON.parse(aEvent.detail);
  if (aEvent.isTrusted && detail.origin === 'rtcweb://peerconnection') {
    idp.process(detail);
  }
}

addEventListener('idp-request', receiveMessage, null);

var idp = new IDPProxy();