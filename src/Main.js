const DOCXManager = require('./DOCXManager.js');
const Grammarly = require('./Grammarly.js');
const Util = require('./Util.js');

(async function() {
    var filePath = process.argv[2];
    if (filePath == undefined || filePath.trim() == '')
        return;

    Util.log("Initializing...");
    await DOCXManager.init(filePath);
    DOCXManager.readParagraphs();
    await Grammarly.init();

    Util.log("Checking...");
    let res = await Grammarly.check(DOCXManager.toString());

    Util.log(`Fixing ${res.length} issues...`);
    DOCXManager.replaceAll(res);

    Util.log("Writing output...");
    await DOCXManager.updateAndPackage();

    Util.log("Finalizing...");
    Grammarly.shutdown();
    DOCXManager.cleanUp();

    Util.log("-- Correction completed successfully --");
})();