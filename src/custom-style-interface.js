/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

/**
 * @typedef {HTMLStyleElement | ({getStyle: (function():HTMLStyleElement)})}
 */
let CustomStyleProvider;

const PROCESSED_MARKER = '__processedByShadyCSS';
const SEEN_MARKER = '__seenByShadyCSS';

/*
This interface is provided to add document-level <style> elements to ShadyCSS for processing.
These styles must be processed by ShadyCSS to simulate ShadowRoot upper-bound encapsulation from outside styles
In addition, these styles may also need to be processed for @apply rules and CSS Custom Properties

To add document-level styles to ShadyCSS, one can call `ShadyCSS.addDocumentStyle(styleElement)` or `ShadyCSS.addDocumentStyle({getStyle: () => styleElement})`

In addition, if the process used to discover document-level styles can be synchronously flushed, one should set `ShadyCSS.documentStyleFlush`.
This function will be called when calculating styles.

An example usage of the document-level styling api can be found in `examples/document-style-lib.js`
*/
export default class CustomStyleInterface {
  constructor(transformerFn, validateFn) {
    this.transformerFn = transformerFn;
    this.validateFn = validateFn;
    /** @type {!Array<!CustomStyleProvider>} */
    this.customStyles = [];
    this.enqueued = false;
  }
  /**
   * Queue a validation for new custom styles to batch style recalculations
   */
  enqueueDocumentValidation() {
    if (this.enqueued) {
      return;
    }
    this.enqueued = true;
    if (window['HTMLImports']) {
      window['HTMLImports']['whenReady'](this.validateFn);
    } else if (document.readyState === 'complete') {
      /*
      TODO(dfreedm): Must implement a batching procedure when native HTML Imports are used to facilitate batching due to O(n^2) processing
      */
      this.validateFn();
    } else {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'complete') {
          this.validateFn();
        }
      });
    }
  }
  /**
   * @param {!HTMLStyleElement} style
   */
  addCustomStyle(style) {
    if (!style[SEEN_MARKER]) {
      style[SEEN_MARKER] = true;
      this.customStyles.push(style);
      this.enqueueDocumentValidation();
    }
  }
  /**
   * @param {!CustomStyleProvider} customStyle
   * @return {HTMLStyleElement}
   */
  getStyleForCustomStyle(customStyle) {
    let style;
    if (customStyle['getStyle']) {
      style = customStyle['getStyle']();
    } else {
      style = customStyle;
    }
    return style;
  }
  findStyles() {
    for (let i = 0; i < this.customStyles.length; i++) {
      let customStyle = this.customStyles[i];
      if (customStyle[PROCESSED_MARKER]) {
        continue;
      }
      let style = this.getStyleForCustomStyle(customStyle);
      if (style) {
        customStyle[PROCESSED_MARKER] = true;
        // HTMLImports polyfill may have cloned the style into the main document,
        // which is referenced with __appliedElement.
        // Also, we must copy over the attributes.
        let appliedStyle = /** @type {HTMLStyleElement} */(style['__appliedElement']);
        if (appliedStyle) {
          for (let i = 0; i < style.attributes.length; i++) {
            let attr = style.attributes[i];
            appliedStyle.setAttribute(attr.name, attr.value);
          }
        }
        this.transformerFn(appliedStyle || style);
      }
    }
  }
}