import { View } from '../../domain/entities/View';
import { ElementType } from '../../domain/entities/ElementType';
import { Constraints } from '../../domain/entities/Constraints';
import * as _ from 'lodash';
import { ButtonParser } from './ElementParsers/ButtonParser';
import { Button } from '../../domain/entities/Button';
import { IElementParser } from './ElementParsers/IElementParser';
import { TextViewParser } from './ElementParsers/TextViewParser';
import { TextView } from '../../domain/entities/TextView';

export interface ISketchParser {
  parseLayer(node: any, hierarchy: number, outputs: any[]);
  parseElement(node: any, view: View);
  parseConstraint(value: number, viewObj: object);
}

export class SketchParser implements ISketchParser {
  private sketch: Object;
  private config: Object;

  constructor(sketch: Object, config: Object) {
    this.sketch = sketch;
    this.config = config;
  }

  parseLayer(node: any, hierarchy: number, outputs: any[]) {
    let maxHierarchy: number = this.config['extraction'].maxHierarchy;
    if (!maxHierarchy) {
      maxHierarchy = 3; // default
    }

    // assign default values, but these may be overridden latter procedure.
    const view: View = new View(node, hierarchy);
    this.parseConstraint(node.resizingConstraint, view);

    // `group` translated into `container` which holds various views on it
    if (
      node._class === 'group' &&
      _.size(node.layers) &&
      hierarchy <= maxHierarchy - 1
    ) {
      outputs.push(view);
      hierarchy++;
      // parse underlying nodes
      node.layers.forEach(aNode => {
        this.parseLayer(aNode, hierarchy, outputs);
      });
    }
    // 'symbolInstance' should be translated into each elements on container views which is originally 'group'
    else if (node._class === 'symbolInstance') {
      const keywords: string[] = this.config['extraction'].keywords;
      if (!keywords || keywords.length <= 0) return;

      const matches: string[] = keywords.filter(keyword => {
        const results = node.name.match(new RegExp(keyword, 'g'));
        return results && results.length > 0 ? true : false;
      });
      if (!matches || matches.length <= 0) {
        // the node is symbol but doesn't match any keywords, so just skip it.
        return;
      }

      // matchesは最後にマッチしたものを採用する。例えば keywords[]に `Button`, `View`があったとして
      // node.nameが `Final View Button` とかだと、複数のkeywordsにマッチする。
      // この時、英語文法的にこのnodeはボタンと想定されるので、最後にマッチした要素を利用するのが自然では。
      view.type = <ElementType>matches[matches.length - 1];

      this.parseElement(node, view);
      outputs.push(view);
    }
  }

  parseElement(node: any, view: View) {
    let parser: IElementParser;
    switch (view.type) {
      case ElementType.Button:
        parser = new ButtonParser(this.sketch, this.config);
        parser.parse(node, <Button>view);
        break;
      case ElementType.TextView:
        parser = new TextViewParser(this.sketch, this.config);
        parser.parse(node, <TextView>view);
        break;
      default:
        break;
    }
  }

  /**
   * Parse constraint value and output to view object.
   * Each constraints are re-assigned later considering related margins.
   * @param value bitmasked constraint value
   * @param view parsed view object
   */
  parseConstraint(value: number, view: View) {
    // https://medium.com/zendesk-engineering/reverse-engineering-sketchs-resizing-functionality-23f6aae2da1a
    const bitWiseAnd: number = parseInt(value.toString(2));
    const bitWiseAndPadded: string = ('0000000000' + bitWiseAnd).slice(-6);
    const constraints: Constraints = {
      none: bitWiseAndPadded === '111111' ? 1 : 0,
      top: bitWiseAndPadded.substr(0, 1) === '0' ? 1 : 0,
      right: bitWiseAndPadded.substr(5, 1) === '0' ? 1 : 0,
      bottom: bitWiseAndPadded.substr(2, 1) === '0' ? 1 : 0,
      left: bitWiseAndPadded.substr(3, 1) === '0' ? 1 : 0,
      width: bitWiseAndPadded.substr(4, 1) === '0' ? 1 : 0,
      height: bitWiseAndPadded.substr(1, 1) === '0' ? 1 : 0,
    } as Constraints;
    view.constraints = constraints;
  }
}