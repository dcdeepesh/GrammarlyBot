const WebSocket = require("ws");
const Axios = require("axios");
const Util = require("./Util.js");

const WEBSOCKET_URL = "wss://capi.Grammarly.com/freews";
const COOKIE_URL = "https://Grammarly.com/";
const ORIGIN = "chrome-extension://kbfnbcaeplbcioakkpcpgfkobkghlhen";
const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0";

class Grammarly {
    static async init() {
        Grammarly.msgHandlers = new Map();
        Grammarly.repObjs = [];

        Grammarly.firstCheck = true;
        Grammarly.checkRev = 0;
        Grammarly.checkId = 1;
        Grammarly.doc_len = 0;
    
        async function getCookie() {
            var response = await Axios.get(COOKIE_URL);
            var cookie = response
                .headers["set-cookie"]
                .map(c => c.split(";")[0])
                .join("; ");
            
            return cookie;
        }

        async function initiate() {
            Grammarly.webSocket.send(JSON.stringify({
                type: "initial",
                token: null,
                docid: "dfad0927-7b35-e155-6de9-4a107053da35-43543554345",
                client: "extension_chrome",
                protocolVersion: "1.0",
                clientSupports: [
                    "free_clarity_alerts",
                    "readability_check",
                    "filler_words_check",
                    "sentence_variety_check",
                    "free_occasional_premium_alerts"
                ],
                dialect: "american",
                clientVersion: "14.924.2437",
                extDomain: "editpad.org",
                action: "start",
                id: 0
            }));
    
            return new Promise(resolve => {
                Grammarly.addTempMsgHandler({id: 0}, () => resolve());
            });
        }

        // initialize websocket
        var cookie = await getCookie();
        Grammarly.webSocket = new WebSocket(WEBSOCKET_URL, {
            origin: ORIGIN,
            headers: {
                "Cookie": cookie,
                "User-Agent": USER_AGENT
            }
        });
        Grammarly.webSocket.onerror = () => Util.log("Websocket error:\n" + event);
        Grammarly.webSocket.onmessage = Grammarly.onMessage;
        await new Promise(resolve => Grammarly.webSocket.onopen = () => resolve());

        
        // add default handlers (TODO)
        Grammarly.addPermMsgHandler({action: "alert"}, Grammarly.onAlert);
        Grammarly.addPermMsgHandler({action: "emotions"}, () => {});
        Grammarly.addPermMsgHandler({action: "submit_ot"}, () => {});
        Grammarly.addPermMsgHandler({action: "remove"}, () => {});

        await initiate();
        Util.log("Network IO handler ready");
    }

    static async check(str) {
        Grammarly.repObjs = [];

        // if this is not the first request, first delete the existing text
        if (!Grammarly.firstCheck) {
            Grammarly.webSocket.send(JSON.stringify({
                id: Grammarly.id++,
                rev: Grammarly.rev++,
                action: "submit_ot",
                doc_len: Grammarly.doc_len,
                chunked: false,
                deltas: [{ops: [{delete: Grammarly.doc_len}]}]
            }));
            Grammarly.doc_len = 0;

            await new Promise(resolve => {
                Grammarly.addTempMsgHandler({action: "finished"}, () => resolve());
            });
        } else Grammarly.firstCheck = false;

        // now send the new text to check
        Grammarly.webSocket.send(JSON.stringify({
            id: Grammarly.id++,
            action: "submit_ot",
            doc_len: Grammarly.doc_len,
            rev: Grammarly.rev++,
            chunked: false,
            deltas: [{ops: [{insert: str}]}]
        }));

        Grammarly.doc_len = str.length;

        return new Promise(resolve => {
            Grammarly.addTempMsgHandler({action: "finished"}, () =>
                resolve(Grammarly.repObjs)
            );
        });
    }

    static onMessage(msgEvent) {
        function getMsgHandlerFor(msg) {
            var msgObj = JSON.parse(msg);
            var found = false;
            var matchedHandler = null;
    
            Grammarly.msgHandlers.forEach((handler, key) => {
                if (found) return;
    
                var match = true;
                for (let property of Object.keys(key))
                    if (key[property] != msgObj[property])
                        match = false;
    
                if (match) {
                    matchedHandler = handler;
                    found = true;
                }
            });
    
            return matchedHandler;
        }

        var msg = msgEvent.data;
        var handle = getMsgHandlerFor(msg);

        if (handle != null) handle(msg);
        else Util.log(`Unhandled msg:\n${msg}`);
    }

    static onAlert(msg) {
        var obj = JSON.parse(msg);
        
        if (obj.hidden || obj.cardLayout.outcome != 'Correctness')
            return;

        var s = obj.begin;
        var e = obj.end;
        var r = obj.replacements;
        var t = obj.text;

        if (Util.notNull(s, e, r, t) && r.length == 1) {
            var rep = r[0];
            if (rep.endsWith(' ') && rep.trim() != '')
                rep += t;

            Grammarly.repObjs.push({s, e, t, r: rep});
        }
    }
    
    static addTempMsgHandler(key, handler) {
        function removeHandler(key) {
            var found = false;
            Grammarly.msgHandlers.forEach((_, mapKey) => {
                if (!found && Util.deepEqual(key, mapKey)) {
                    Grammarly.msgHandlers.delete(mapKey);
                    found = true;
                }
            });
        }

        Grammarly.msgHandlers.set(key, msg => {
            handler(msg);
            removeHandler(key);
        })
    }

    static addPermMsgHandler(key, handler) { Grammarly.msgHandlers.set(key, handler); }

    static shutdown() { Grammarly.webSocket.close(); }
}

module.exports = Grammarly;