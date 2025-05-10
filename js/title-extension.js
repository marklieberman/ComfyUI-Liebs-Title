import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';

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
	name: 'LiebsNodes',
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
            if (!app.graph.extra.liebsTabTitleVars) {
                app.graph.extra.liebsTabTitleVars = {};
            }
            Object.assign(app.graph.extra.liebsTabTitleVars, detail);
            setTimeout(() => onDocumentTitleChanged(realTitle));
        });
    },
    afterConfigureGraph() {
        // Set the document title on first load of the graph.
        onDocumentTitleChanged(realTitle);
        watchDocumentTitle(true);
    }
});
