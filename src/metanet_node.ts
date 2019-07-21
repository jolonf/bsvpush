const bsv = require('bsv')

/**
 * Represents a metanet directory or file.
 */
export class MetanetNode {
  // Stored fields
  keyPath: string; // e.g. m/0/1/0/3
  txId: string; // Metanet transaction id, will be stored and retrieved
  index: number; // last index in the keyPath
  name: string;
  children = {};
  removed = false; // will be set to true if child exists but appears in ignore list

  // Fields which aren't stored
  dir = ''; // this is used solely for displaying to the user
  fee = 0;
  opreturn = []; // Array of hex strings
  utxos = []; // UTXOs for this private key, will be used to create new children

  constructor(json: any = null) {
    if (json !== null) {
      this.fromJSON(json);
    }
  }

  fromJSON(json: any) {
    this.keyPath = json.keyPath;
    this.txId = json.txId;
    this.index = json.index;
    this.name = json.name;
    this.removed = json.removed;
    const keys = Object.keys(json.children);
    keys.forEach(child => this.children[child] = new MetanetNode(json.children[child]));
  }

  toJSON(): any {
    let json = {
      keyPath: this.keyPath,
      txId: this.txId,
      index: this.index,
      name: this.name,
      removed: this.removed,
      children: {}
    };
    const keys = Object.keys(this.children);
    keys.forEach(child => json.children[child] = this.children[child].toJSON());
    return json;
  }

  childExists(name: string): boolean {
    return this.children.hasOwnProperty(name);
  }

  /**
   * Gets child node with specified name. If the child doesn't exist, creates it.
   * @param name 
   */
  child(name: string): MetanetNode {
      return this.children[name];
  }

  /**
   * Adds a child with the specified name.
   * @param name 
   */
  addChild(name: string): MetanetNode {
    const child = new MetanetNode();
    child.index = this.nextIndex();
    child.keyPath = this.keyPath + `/${child.index}`;
    child.name = name;
    this.children[name] = child;
    return child;
  }

  remove() {
    this.removed = true;
  }

  getUnremovedChildKeys() {
    return Object.keys(this.children).filter(key => !this.children[key].removed);
  }

  /**
   * Finds the next available child index.
   */
  nextIndex(): number {
    const keys = Object.keys(this.children)
    if (keys.length > 0) {
        let maxIndexKey = keys.reduce((a, b) => this.children[a].index > this.children[b].index ? a : b)
        return this.children[maxIndexKey].index + 1
    } else {
      return 0
    }
  }
}