import { View } from '../../../domain/entities/View';
import { IElementParser } from './IElementParser';
import { ElementType } from '../../../domain/entities/ElementType';

export type SymbolElement<T> = { key: T };
export abstract class SymbolParser implements IElementParser {
  private sketch: Object;
  private config: Object;

  public subLayers?: any[];
  public get followOverrides(): boolean {
    return this.config['extraction'].followOverrides;
  }
  public get layerStyles(): any[] {
    return this.sketch['layerStyles'];
  }

  constructor(sketch: Object, config: Object) {
    this.sketch = sketch;
    this.config = config;
  }

  parse(node: any, view: View) {
    const symbolsPage = this.sketch['symbolsPage'];
    const targetSymbol = symbolsPage.get(
      'symbolMaster',
      instance => instance.symbolID === node.symbolID,
    );
    if (
      !targetSymbol ||
      !targetSymbol.layers ||
      targetSymbol.layers.length <= 0
    )
      return;

    // TBD: exclude 'shapeGroup' because it's info is too large to deal with at this time.
    this.subLayers = targetSymbol.layers.filter(
      layer => layer._class !== 'shapeGroup',
    );
  }

  abstract parseSharedStyle(node: any, styleType: string, view: View);
  abstract parseOverride(node: any, styleType: string, view: View);

  getSymbolElements(elementType: ElementType): SymbolElement<string> {
    return this.config['extraction'][(elementType as string).toLowerCase()];
  }

  getSubLayerFor(key: string, elements: SymbolElement<string>): any {
    if (!this.subLayers || this.subLayers.length <= 0) return null;
    // TBD: 命名規則で大文字小文字を指定したものをここでも踏襲したほうがいいのではと
    const nameKey = key.charAt(0).toUpperCase() + key.slice(1); // とりあえず頭文字だけ大文字
    const matchedLayers = this.subLayers.filter(
      layer => layer.name === nameKey && layer._class === elements[key],
    );
    return matchedLayers[0];
  }
}