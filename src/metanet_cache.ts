const bsv = require('bsv')

import { MetanetNode } from "./metanet_node";

/**
 * Represents the .bsvpush/metanet.json file which contains the metanet master private key
 * and all nodes pushed to metanet.
 */
export class MetanetCache {
  masterKey;
  root: MetanetNode;

  constructor(json: any) {
    this.fromJSON(json)
  }

  fromJSON(json: any) {
    this.masterKey = bsv.HDPrivateKey(json.masterKey);
    this.root = new MetanetNode(json.root);
  }

  toJSON(): any {
    const json = {
      masterKey: this.masterKey.xprivkey,
      root: this.root.toJSON()
    }
    return json;
  }
}