'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class WidgetElement extends EventTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.classList = {
      add: (...names) => {
        this.className = [
          ...new Set([...this.className.split(' ').filter(Boolean), ...names]),
        ].join(' ');
      },
      remove: (name) => {
        this.className = this.className
          .split(' ')
          .filter((entry) => {
            return entry !== name;
          })
          .join(' ');
      },
      toggle: (name, force) => {
        if (force) {
          this.classList.add(name);
        } else {
          this.classList.remove(name);
        }
      },
    };
  }

  set textContent(value) {
    this.children = [];
    this.text = String(value ?? '');
  }

  get textContent() {
    return (
      (this.text || '') +
      this.children
        .map((child) => {
          return child.textContent;
        })
        .join('')
    );
  }

  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  insertBefore(child, reference) {
    child.remove();
    child.parent = this;
    const index = reference ? this.children.indexOf(reference) : this.children.length;
    this.children.splice(index, 0, child);
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  replaceChildren(...children) {
    this.text = '';
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((child) => {
        return child !== this;
      });
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }
}

function loadWidget(context, widgetId) {
  const directory = path.resolve(__dirname, '../../widgets', widgetId, 'public');
  const sandbox = vm.createContext(context);
  for (const asset of [
    'widget-result.js',
    'widget-markdown.js',
    'widget-controller.js',
    'widget-host.js',
    'result-renderer.js',
    'widget.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(directory, asset), 'utf8'), sandbox);
  }
}

module.exports = { WidgetElement, loadWidget };
