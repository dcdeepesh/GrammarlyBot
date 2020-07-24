const DOCXManager = require('./DOCXManager.js');
const Grammarly = require('./Grammarly.js');
const Util = require('./Util.js');

class Main {
    static async foo() {
        var filePath = process.argv[2];
        if (filePath == undefined || filePath.trim() == '')
            return;

        Util.log("Initializing...");
        await Grammarly.init();
        await DOCXManager.init(filePath);
        DOCXManager.readParagraphs();
        
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
    }
}

Main.foo().catch(error => Util.log(error));