import { xmlEncode } from "../../../utils/utils.js";

interface CacheFieldConfig {
  name: string;
  sharedItems: string[] | null;
}

class CacheField {
  declare private name: string;
  declare private sharedItems: string[] | null;

  constructor({ name, sharedItems }: CacheFieldConfig) {
    // string type
    //
    // {
    //   'name': 'A',
    //   'sharedItems': ['a1', 'a2', 'a3']
    // }
    //
    // or
    //
    // integer type
    //
    // {
    //   'name': 'D',
    //   'sharedItems': null
    // }
    this.name = name;
    this.sharedItems = sharedItems;
  }

  render(): string {
    // PivotCache Field: http://www.datypic.com/sc/ooxml/e-ssml_cacheField-1.html
    // Shared Items: http://www.datypic.com/sc/ooxml/e-ssml_sharedItems-1.html

    // Escape XML special characters in name attribute
    const escapedName = xmlEncode(this.name);

    // integer types
    if (this.sharedItems === null) {
      // TK(2023-07-18): left out attributes... minValue="5" maxValue="45"
      return `<cacheField name="${escapedName}" numFmtId="0">
      <sharedItems containsSemiMixedTypes="0" containsString="0" containsNumber="1" containsInteger="1" />
    </cacheField>`;
    }

    // string types - escape XML special characters in each shared item value
    return `<cacheField name="${escapedName}" numFmtId="0">
      <sharedItems count="${this.sharedItems.length}">
        ${this.sharedItems.map(item => `<s v="${xmlEncode(String(item))}" />`).join("")}
      </sharedItems>
    </cacheField>`;
  }
}

export { CacheField };
