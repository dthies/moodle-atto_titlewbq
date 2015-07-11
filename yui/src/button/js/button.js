// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/*
 * @package    atto_titlewbq
 * @copyright  2015 Daniel Thies
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @module moodle-atto_titlewbq-button
 */

/**
 * Atto text editor titlewbq plugin.
 *
 * @namespace M.atto_titlewbq
 * @class button
 * @extends M.editor_atto.EditorPlugin
 */

var component = 'atto_titlewbq',
    styles = [
        {
            text: 'h3',
            callbackArgs: '<h3>'
        },
        {
            text: 'h4',
            callbackArgs: '<h4>'
        },
        {
            text: 'h5',
            callbackArgs: '<h5>'
        },
        {
            text: 'pre',
            callbackArgs: '<pre>'
        },
        {
            text: 'p',
            callbackArgs: '<p>'
        },
        {
            text: 'blockquote',
            callbackArgs: '<blockquote>'
        }
    ];

Y.namespace('M.atto_titlewbq').Button = Y.Base.create('button', Y.M.editor_atto.EditorPlugin, [], {
    initializer: function() {
        var items = [];
        Y.Array.each(styles, function(style) {
            items.push({
                text: M.util.get_string(style.text, style.text ==='blockquote'? component : 'atto_title'),
                callbackArgs: style.callbackArgs
            });
        });
        this.addToolbarMenu({
            icon: 'e/styleprops',
            globalItemConfig: {
                callback: this._changeStyle
            },
            items: items
        });

        // Add handling backspace to escape blockquote.
        this.setupEscapeBlockquote();
    },

    /**
     * Change the title to the specified style.
     *
     * @method _changeStyle
     * @param {EventFacade} e
     * @param {string} color The new style
     * @private
     */
    _changeStyle: function(e, style) {
        if (style === '<blockquote>') {
            document.execCommand('indent', false, style);
        } else {
            this.safeOutdent();
            document.execCommand('formatBlock', false, style);
        }

        // Mark as updated
        this.markUpdated();
    },
 
     /**
     * Listen for a backspace at the beginning of line and then exit an indent or block quotation.
     *
     * @method setupEscapeBlockquote
     * @chainable
     */
    setupEscapeBlockquote: function() {
        // Listen for backspace.
        this.editor.on('key', function(e) {
            var BLOCKS_SELECTOR = this.get('host').BLOCK_TAGS.join(', ');

            // Check whether the selection is collapsed and at start of a node.
            var selection = window.rangy.getSelection();
            if (!selection.isCollapsed ||
                !Y.one(selection.anchorNode).ancestor('blockquote', true) ||
                (!selection.anchorNode.tagName && selection.anchorOffset)) {
                return;
            }
            // Check whether anchor node is a text node and find node marking start.
            var precedingText = '';
            // Recursely search to find whether there is text before node after newline in block.
            function getPrecedingText(node) {
                if (!node.previousSibling) {
                    var parent = node.parentNode;
                    if (Y.one(parent).test(BLOCKS_SELECTOR)) {
                        return '';
                    }
                    return getPrecedingText(parent);
                }

                if (node.previousSibling.tagName &&
                        node.previousSibling.tagName.toLowerCase() === 'br') {
                    return '';
                }
                return node.previousSibling.textContent ||
                    getPrecedingText(node.previousSibling);
            }
            if (selection.anchorOffset !== 0) {
                // if (!selection.anchorNode.tagName || selection.anchorNode.tagName === '#text') {
                if (selection.anchorNode.hasChildNodes()) {
                // Find text before the node indicated by offset.
                    precedingText = getPrecedingText(selection.anchorNode.childNodes.item(selection.anchorOffset));
                } else {
                    // Offset points to position in string.
                    precedingText = selection.anchorNode.textContent.slice(0, selection.anchorOffset - 1);
                }
            } else if (!Y.one(selection.anchorNode).compareTo(selection.anchorNode) ||
                    !Y.one(selection.anchorNode).test(BLOCKS_SELECTOR)) {
                // Find text before anchor node if it is not a block.
                precedingText = getPrecedingText(selection.anchorNode);
            }

            if(precedingText.replace(/.*\n/, '')) {
                return;
            }

            if (Y.one(selection.anchorNode).ancestor(BLOCKS_SELECTOR, true, '.atto-editor-content')) {
                document.execCommand('formatBlock', false, 'p');
            }

            // If this beginning of line, outdent the blockquote.
            e.preventDefault();
            this.safeOutdent();

            // Mark as updated
            this.markUpdated();

            this.get('host').saveSelection();
        }, 'backspace', this);

        return this;
    },

    /**
     * Outdent blockquote is a manner consistent across browsers
     * @method safeOutdent
     */
    safeOutdent: function() {
        // IE applies styling of blockquote to child element so these need to be removed.
        this.editor.all('blockquote').removeAttribute('style');
        this.editor.all('blockquote').removeAttribute('class');

        // Separate all the children in selected blockquotes because they misbehave when together with Chrome and Safari.
        this.divideBlockquotes();

        // Outdent once if possible
        document.execCommand('outdent', false, null);

        // Combine neighboring blockquotes.
        this.mergeBlockquotes();
    },

    /**
     * Divides all blockquotes in the selection so that each has a single child
     * @method divideBlockquotes
     */
    divideBlockquotes: function() {
        // Save selection once more and remove display attributes.
        var selection = window.rangy.saveSelection();
        this.editor.all('.rangySelectionBoundary').setStyle('display', null);

        // Find an ancestor of all blockquotes that may be outdented.
        var container = Y.one(this.get('host').getSelectionParentNode()).ancestor('blockquote', true) ||
            Y.one(this.get('host').getSelectionParentNode());
        container
            .all('blockquote')
            .each(function(blockquote) {
                var children = blockquote.getDOMNode().childNodes;
                // Remove white space between blocks.
                for (var i = children.length; i > 0; i--) {
                    var child = children[i - 1];
                    if ((!child.tagName || (child.tagName.toLowerCase() === '#text')) && /^\s*$/.test(child.nodeValue)) {
                        child.remove();
                    }
                }
                // Mark this to be combined again later.
                blockquote.addClass('atto-merge-blockquote');
                // Create and separate blockquote parent for each child.
                while (children.length > 1) {
                    var clone = blockquote.cloneNode(false);
                    blockquote.ancestor().insertBefore(clone, blockquote);
                    clone.append(children[0]);
                }
        });

        // Restore selection.
        window.rangy.restoreSelection(selection);
    },

    /**
     * Merges neighboring blockquotes in the selection
     * @method mergeBlockquotes
     */
    mergeBlockquotes: function() {
        // Save selection once more and remove display attributes.
        var selection = window.rangy.saveSelection();
        this.editor.all('.rangySelectionBoundary').setStyle('display', null);

        // Check all marked blockquotes to see if they have a neighbor.
        this.editor
            .all('blockquote.atto-merge-blockquote')
            .each(function(blockquote) {
                var next = blockquote.getDOMNode().nextSibling;
                while (next && next.tagName && next.tagName.toLowerCase() === 'blockquote' &&
                        Y.one(next).test('.atto-merge-blockquote')) {
                    // Move neighbor's children into first blockquote.
                    var children = next.childNodes;
                    while (children.length > 0) {
                        blockquote.append(children[0]);
                    }
                    // Remove empty blockquote.
                    Y.one(next).remove();
                    next = blockquote.getDOMNode().nextSibling;
                }
            });
        // Remove the marker class.
        this.editor.all('blockquote[class="atto-merge-blockquote"]').removeAttribute('class');
        this.editor.all('.atto-merge-blockquote').removeClass('atto-merge-blockquote');

        // Restore selection.
        window.rangy.restoreSelection(selection);
   }

});
