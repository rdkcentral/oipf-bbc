const hasOwn = Object.prototype.hasOwnProperty;
const toString = Object.prototype.toString;

let classes = ['Boolean', 'Number', 'String', 'Function', 'Array', 'Date', 'RegExp', 'Object'];
let class2type = {};

for (var i in classes) {
    if (classes.hasOwnProperty(i)) {
        let name = classes[i];
        class2type[`[object ${name}]`] = name.toLowerCase();
    }
}

/**
 * @ignore
 * @param {Object} obj The object to check
 * @return {String} The type of the passed in object. Is one one of:
 *  Boolean
 *  Number
 *  String
 *  Function
 *  Array
 *  Date
 *  RegExp
 *  Object
 */
export function typeOf(obj) {
    return null === obj || undefined === obj ? String(obj) : class2type[toString.call(obj)] || 'object';
}

/**
 * @ignore
 * @param {Object} obj - object to test
 * @param {Boolean} - returns true if obj inherits from Object, has its own defined constructor and has no properties or has not inherited any properties
 */
var isPlainObject = function isPlainObject(obj) {
    if (!obj || toString.call(obj) !== '[object Object]') {
        return false;
    }

    var has_own_constructor = hasOwn.call(obj, 'constructor');
    var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
    // Not own constructor property must be Object
    if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
        return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var key;
    for (key in obj) {
    }

    return key === undefined || hasOwn.call(obj, key);
};

/**
 * Syntax: merge (target, object1, [objectN] )
 * Extend one object with one or more others, returning the modified object.
 * Keep in mind that the target object will be modified, and will be returned from extend().
 * Undefined properties are not copied. However, properties inherited from the object's prototype
 * will be copied over.
 * @ignore
 *
 * @param {Object} target - The object to extend. Can be null in which case will be a copy to a new object.
 * @param {Object} object1 - The object that will be merged into the first.
 * @param {Object} [objectN] - More objects to merge into the first.
 * @returns {Object} - the modified target object
 */
export function merge() {
    var options,
        name,
        src,
        copy,
        copyIsArray,
        clone,
        target = arguments[0],
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
        target = {};
    }

    for (; i < length; ++i) {
        options = arguments[i];
        // Only deal with non-null/undefined values
        if (options != null) {
            // Extend the base object
            for (name in options) {
                src = target[name];
                copy = options[name];

                // Prevent never-ending loop
                if (target === copy) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if (copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
                    if (copyIsArray) {
                        copyIsArray = false;
                        clone = src && Array.isArray(src) ? src : [];
                    } else {
                        clone = src && isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[name] = merge(clone, copy);

                    // Don't bring in undefined values
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
}

/**
 * This can be used to correct a boolean config value obtained via the url parameters. In the url parameters its value will
 * be a string "false" or "true", this method will return it to a Boolean type.
 *
 * @ignore
 * @param {String/Boolean} val - the "boolean" value from the config file
 * @param {Boolean} defaultVal - if the value is not boolean or not "false" or not "true" then set to this value
 * @return {Boolean} - the updatted value
 */
export function correctToBooleanType(val, defaultVal) {
    val = val === 'true' ? true : val === 'false' ? false : val;
    if (typeOf(val) !== 'boolean') val = defaultVal;
    return val;
}
