import { unified } from 'unified';
import remarkParse from 'remark-parse';

export class MarkdownParser {
  static processor = unified().use(remarkParse);

  static parse(text) {
    return MarkdownParser.processor.parse(text);
  }
}
