import { MarkdownParser } from './MarkdownParser.mjs';

export class MarkdownRenderer {
  static render(container, text) {
    const tree = MarkdownParser.parse(text);
    const definitions = new Map();
    const pending = [tree];

    while (pending.length > 0) {
      const node = pending.pop();

      if (node.type === 'definition' && !definitions.has(node.identifier)) {
        definitions.set(node.identifier, node);
      }

      // Preserve source order: the first reference definition wins.
      for (let index = (node.children?.length || 0) - 1; index >= 0; index -= 1) {
        pending.push(node.children[index]);
      }
    }

    container.classList.add('widget-markdown');
    container.replaceChildren();
    const stack = [];

    for (let index = tree.children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: tree.children[index], parent: container });
    }

    while (stack.length > 0) {
      const { node, parent } = stack.pop();
      const element = MarkdownRenderer.createNode(container.ownerDocument, node, definitions);

      if (!element) {
        continue;
      }

      parent.append(element);
      for (let index = (node.children?.length || 0) - 1; index >= 0; index -= 1) {
        stack.push({ node: node.children[index], parent: element });
      }
    }
  }

  static createNode(document, node, definitions) {
    let tag;

    switch (node.type) {
      case 'text':
        return document.createTextNode(node.value);
      case 'paragraph':
        tag = 'p';
        break;
      case 'heading':
        tag = `h${node.depth}`;
        break;
      case 'strong':
        tag = 'strong';
        break;
      case 'emphasis':
        tag = 'em';
        break;
      case 'blockquote':
        tag = 'blockquote';
        break;
      case 'list': {
        const list = document.createElement(node.ordered ? 'ol' : 'ul');

        if (node.ordered && node.start !== 1) {
          list.setAttribute('start', String(node.start));
        }

        return list;
      }

      case 'listItem':
        tag = 'li';
        break;
      case 'break':
        tag = 'br';
        break;
      case 'thematicBreak':
        tag = 'hr';
        break;
      case 'inlineCode': {
        const code = document.createElement('code');
        code.textContent = node.value;
        return code;
      }

      case 'code': {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = node.value;
        pre.append(code);
        return pre;
      }

      case 'link':
      case 'linkReference': {
        const link = node.type === 'link' ? node : definitions.get(node.identifier);
        const url = MarkdownRenderer.linkUrl(link?.url);
        const element = document.createElement(url ? 'a' : 'span');

        if (url) {
          element.setAttribute('href', url);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
          if (link.title) {
            element.setAttribute('title', link.title);
          }
        }

        return element;
      }

      case 'image':
      case 'imageReference':
        return document.createTextNode(node.alt || '');
      // HTML and definitions never create elements or initiate requests.
      default:
        return null;
    }

    return document.createElement(tag);
  }

  static linkUrl(value) {
    if (typeof value !== 'string') {
      return null;
    }

    for (const character of value) {
      const code = character.codePointAt(0);

      if (code <= 32 || code === 127 || character === '\\') {
        return null;
      }
    }

    try {
      const url = new URL(value);

      if (['https:', 'http:', 'mailto:'].includes(url.protocol)) {
        return url.href;
      }
    } catch {
      // Relative links have no meaningful base in a script result.
    }

    return null;
  }
}
