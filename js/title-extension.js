import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';

/**
 * Generate a unique identifier using current millis and random.
 */
function generateTitleTabId() {
    return `${new Date().valueOf()}_${Math.floor(Math.random() * 1000)}`
}

// Generate or restore the title tab ID.
const TITLE_TAB_ID_KEY  = 'liebsTitleTabId';
var titleTabId = sessionStorage.getItem(TITLE_TAB_ID_KEY);
if (titleTabId) {
    console.log('Restored title tab ID', titleTabId);
} else {
    titleTabId = generateTitleTabId();
    sessionStorage.setItem(TITLE_TAB_ID_KEY, titleTabId);
}

// Monitors the document title for changes.
var observing = false;
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {        
        onDocumentTitleChanged(mutation.target.textContent);        
    });
});

// Store a copy of the real document title.
var realTitle = document.title;
var lastTitle = null;

// Start or stop watching the document title for changes.
function watchDocumentTitle(enabled) {
    if (enabled && !observing) {
        observing = true;
        const options =  { 
            subtree: true, 
            characterData: true, 
            childList: true 
        };
        observer.observe(document.querySelector('head > title'), options);
    } else
    if (!enabled && observing) {
        observing = false;
        observer.disconnect();
    }
}

// Update the document title using our format when someone else modifies it.
function onDocumentTitleChanged(title) {
    if (title !== lastTitle) {
        // Store the real document title.    
        realTitle = title;

        // Replace it with our title.
        doPlaceholderTitleUpdate(title);
    }
}

// Update the title using a placeholder format string.
function doPlaceholderTitleUpdate(title) {
    const placeholder = app.graph.extra.liebsTabTitleFormat;
    if (placeholder) {
        // Replace all variables in the format string.
        lastTitle = placeholder.replaceAll('%title%', title);
        const variables = app.graph.extra?.liebsTabTitleVars ?? {};
        for (const name in variables) {
            lastTitle = lastTitle.replaceAll(`%${name}%`, variables[name]);
        }

        // Replace all unknown variables with (no value).
        lastTitle = lastTitle.replace(/%[a-z0-9_]+%/ig, '(no value)');

        document.title = lastTitle;
    }
}

// Set the new document title format.
function setDocumentTitleFormat(format) {
    // Wrap a the update with change events so that the ChangeTracker will recognize that the graph was modified.
    document.dispatchEvent(new CustomEvent('litegraph:canvas', {
        detail: {
            subType: 'before-change'
        }
    }));
    
    app.graph.extra.liebsTabTitleFormat = format;

    document.dispatchEvent(new CustomEvent('litegraph:canvas', {
        detail: {
            subType: 'after-change'
        }
    }));

    onDocumentTitleChanged(realTitle);
}

// Register the ComfyUI extension.
app.registerExtension({
	name: 'LiebsTitle',
    setup() {
        // Add a change title menu item to the context menu.
        const r = LGraphCanvas.prototype.getCanvasMenuOptions ;
        LGraphCanvas.prototype.getCanvasMenuOptions  = function (name, value, options) {
            const menu = r.apply(this, arguments);
            menu.push({ 
                content: 'Set Browser Tab Title', 
                callback: () => {
                    // Prompt for a tab title.
                    const format = prompt('Provide new title format:', app.graph.extra.liebsTabTitleFormat);
                    if (format) {
                        setDocumentTitleFormat(format);
                    }
                } 
            });
            return menu;
        };

        // Listen for new variable values from the nodes.
        api.addEventListener('liebs-title-vars', (event) => { 
            const detail = event.detail;

            if (titleTabId !== detail.title_tab_id) {
                // Not the tab that ran the prompt.
                return;
            }

            if (!app.graph.extra.liebsTabTitleVars) {
                app.graph.extra.liebsTabTitleVars = {};
            }

            Object.assign(app.graph.extra.liebsTabTitleVars, detail.variables);
            
            setTimeout(() => onDocumentTitleChanged(realTitle));
        });
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeType.comfyClass === 'LiebsTitleVar') { 
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {     
                const r = onNodeCreated?.apply(this, arguments);

                // Add a custom widget for the hidden title_tab_id input.
                // Nothing is displayed in the node.
                this.addCustomWidget({
                    type: 'STRING',
                    name: 'title_tab_id',
                    computeSize() {
                        return [0,0]
                    },
                    async serializeValue(nodeId, widgetIndex) {
                        return titleTabId;
                    }
                });

                return r;
            }
        }
    },
    afterConfigureGraph() {
        // Set the document title on first load of the graph.
        onDocumentTitleChanged(realTitle);
        watchDocumentTitle(true);
    }
});

/**
 * We generate a unique ID for each tab running ComfyUI. This unique "title tab ID" makes the messages from the prompt 
 * server addressable to the tabs. The title tab ID is stored in sessionStorage so it will persist even when the tab 
 * is refreshed. 
 * 
 * The Duplicate Tab function in browsers will also duplicate the sessionStorage contents. Using a BroadcastChannel, we 
 * can ask other ComfyUI tabs if the title tab ID we restored is already being used. A new title tab ID can be 
 * generated if so.
 */

// Setup a channel to communicate with other tabs running ComfyUI.
const broadcastChannel = new BroadcastChannel('liebs-title');
broadcastChannel.addEventListener('message', (event) => {    
    const message = event.data;    
    switch (message?.topic) {
        // Another tab is asking for our title tab ID.
        case 'getTitleTabId':            
            broadcastChannel.postMessage({
                topic: 'usingTitleTabId',
                titleTabId
            });
            break;
        // Another tab is reporting which title tab ID it is using.
        case 'usingTitleTabId':            
            if (message.titleTabId === titleTabId) {
                // Need to generate a new title tab ID.
                titleTabId = generateTitleTabId();
                sessionStorage.setItem(title_TAB_ID_KEY, titleTabId);
                console.log('Generated a new title tab ID', titleTabId);
            }
    }
});

// Ask all of the other tabs for their title tab ID.
broadcastChannel.postMessage({
    topic: 'getTitleTabId'
});
