/**
 * Description
 * ===========
 * The Application Manager object is used to manage the loading, unloading and configuration of applications.
 * Because the Horizon 4 environment does not support nested applications this is a cut down version of OIPF specified ApplicationManager
 *
 * How To Use
 * ==========
 *
 * EITHER:
 *      Add the following HTML to your document; <object id="applicationManager" type="application/oipfApplicationManager"></object>
 *      Use document.getElementById to access this object. Any other dom lookup methods are not supported.
 * OR:
 *      Call the method oipfObjectFactory.createApplicationManagerObject() to gain an instance of the ApplicationManager object.
 *      Insert the object into your document.
 *
 */

import 'oipf/oipf.scss';
import { init as initApplicationContext, application } from 'oipf/applicationContext';
import OipfError from 'datamodel/oipfError';

/*
 * OipfError codes used in this file
 * =================================
 *  501  ApplicationManager   — attempted to create a second instance (singleton)
 */

let applicationManagerInstance;

export function init() {
    initApplicationContext();
}

/**
 * @constructor
 * @param {application/oipfApplicationManager}[applicationManager] If an applicationManager tag has already been created in the Dom, this is that element.
 */
export default function ApplicationManager(applicationManager) {
    if (applicationManagerInstance) {
        if (applicationManager && applicationManager !== applicationManagerInstance) {
            throw new OipfError(501, 'ApplicationManager is a singleton; a different instance already exists.');
        }
        return applicationManagerInstance;
    }

    if (!applicationManager) {
        applicationManager = document.createElement('object');
        applicationManager.type = 'application/oipfApplicationManager';
    }

    Object.assign(applicationManager, {
        instantiated: true,
        getOwnerApplication: function() {
            return application;
        }
    });

    applicationManagerInstance = applicationManager;

    return applicationManager;
}
