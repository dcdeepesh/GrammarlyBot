class Util {
    static log(msg) {
        console.log(msg);
    }

    static notNull(...objs) {
        for (let obj in objs)
            if (obj == null || obj == undefined)
                return false;

        return true;
    }

    static deepEqual(a, b) {
        if (a == null || b == null)
            return (a == null && b == null);
    
        if (typeof a != "object") {
            if (typeof b == "object")
                return false;
    
            return a == b;
        }
        // 'a' is now confirmed to be an object
    
        if (typeof b != "object")
            return false;
    
        let keys1 = Object.keys(a), keys2 = Object.keys(b);
        // different keys/different numbers of keys => unequal
        if (keys1.length != keys2.length)
            return false;
        for (let i = 0; i < keys1.length; i++)
            if (keys1[i] != keys2[i])
                return false;
    
        for (let key of keys1)
            if (a[key] != b[key])
                return false;
    
        return true;
    }
}

module.exports = Util;