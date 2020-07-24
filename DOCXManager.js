const fs = require('fs');
const DZip = require('decompress-zip');
const DOMParser = require('xmldom').DOMParser;
const XMLSerializer = require('xmldom').XMLSerializer;
const Util = require("./Util.js");
var archiver = require('archiver');

const XMLNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

class DOCXManager {
    static async init(filePath) {
        var zd = new DZip(filePath);
        zd.on('error', err => console.log(`Decompression ${err}`));

        DOCXManager.ouputFilePath =
            filePath.substring(0, filePath.lastIndexOf('.')) + '_GC.docx';

        DOCXManager.tempDir = fs.mkdtempSync('docx');
        DOCXManager.docxmlPath = DOCXManager.tempDir+'/word/document.xml';

        zd.extract({
            path: DOCXManager.tempDir,
            restrict: false
        });

        await new Promise(resolve => zd.on('extract', () => resolve()));
        Util.log("Document decompressed");
    }

    static readParagraphs() {
        var fileContents = fs.readFileSync(DOCXManager.docxmlPath).toString();
        DOCXManager.xmldoc = new DOMParser().parseFromString(fileContents, 'text/xml');

        var paragraphs = DOCXManager.xmldoc.getElementsByTagNameNS(XMLNS, 'p');
        DOCXManager.texts = DOCXManager.xmldoc.getElementsByTagNameNS(XMLNS, 't');
        DOCXManager.fullText = '';
        DOCXManager.cumulativeLen = [];
        var totalLength = 0;

        for (let i = 0; i < paragraphs.length; i++) {
            var texts = paragraphs[i].getElementsByTagNameNS(XMLNS, 't');

            for (let j = 0; j < texts.length; j++) {
                var text = texts[j].textContent;

                DOCXManager.fullText += text;
                totalLength += text.length;
                DOCXManager.cumulativeLen.push(totalLength);
            }

            if (texts.length != 0)  {
                DOCXManager.fullText += '\n';
                DOCXManager.cumulativeLen.push(DOCXManager.cumulativeLen.pop() + 1);
                totalLength++;
            }
        }

        Util.log("DOM ready");
    }

    static replaceAll(repObjs) {
        function replaceSingle(repObj) {
            var rs = repObj.s;
            var re = repObj.e;
            var rr = repObj.r;

            for (var i = 0; i < DOCXManager.cumulativeLen.length; i++)
                if (rs < DOCXManager.cumulativeLen[i])
                    break;

            if (i < 0)
                throw new Error(`Replacement start (${rs}) too long`);

            var prev = (i == 0 ? 0 : DOCXManager.cumulativeLen[i-1]);
            var start = rs - prev;
            var end = Math.min(re, DOCXManager.cumulativeLen[i]) - prev;

            // change the text in the current block
            DOCXManager.texts[i].textContent
                = DOCXManager.texts[i].textContent.substring(0, start)
                + rr
                + DOCXManager.texts[i].textContent.substring(end);
    
            // if the replacement spans accross text runs, change further blocks
            while (re > DOCXManager.cumulativeLen[i]) {
                console.log("----MultiRun");
                i++;
                if (i >= DOCXManager.cumulativeLen.length)
                    throw new Error(`Replace end too long (${re})`);
                
                start = Math.min(re, DOCXManager.cumulativeLen[i]);

                DOCXManager.texts[i].textContent
                    = DOCXManager.texts[i].textContent.substring(start);
            }
        }

        repObjs = repObjs.sort((a, b) => b.s - a.s);

        for (let repObj of repObjs)
            replaceSingle(repObj);
    }

    static updateAndPackage() {
        //update document.xml
        var newXmlDoc = new XMLSerializer().serializeToString(DOCXManager.xmldoc);
        fs.writeFileSync(DOCXManager.docxmlPath, newXmlDoc);
        console.log("XML updated");

        // compress back to .docx
        var output = fs.createWriteStream(DOCXManager.ouputFilePath);
        var archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('error', err => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(DOCXManager.tempDir+'/', '');

        return new Promise(resolve => {
            output.on('close', function () {
                console.log("Document written");
                resolve();
            });
            archive.finalize();
        });
        
    }

    static cleanUp() { fs.rmdirSync(DOCXManager.tempDir, { recursive:true }); }

    static toString() { return DOCXManager.fullText; }
}

module.exports = DOCXManager;