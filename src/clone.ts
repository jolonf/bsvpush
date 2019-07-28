import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import readline from 'readline-promise';

import BitIndexSDK from 'bitindex-sdk';
import { gunzipSync } from 'zlib';

/**
 * Clones the directory structure represented by the transaction id to the local file system.
 * Note that at this stage it doesn't create the .bsvpush directory or the metanet.json file.
 */
export class Clone {
  bcatProtocol = '15DHFxWZJT58f9nhyGnsRBqrgwK4W6h4Up';
  bFileType = '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut';
  bitindex = new BitIndexSDK();

  async clone(txid: string) {
    const node = await this.getMetanetNode(txid);
    await this.cloneRecursive(node, process.cwd());
  }

  async cloneRecursive(node, dir) {
    if (node.nodeType === this.bFileType || node.nodeType === this.bcatProtocol) {
      const filePath = path.join(dir, node.name);
      console.log(`Cloning file: ${filePath}`);
      const data = await this.getFileData(node.nodeTxId);
      fs.writeFileSync(filePath, data);
    } else {
      // Create a directory for this node
      const newDir = path.join(dir, node.name);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir);
      }
      // Get children
      const children = await this.getChildNodes(node.nodeTxId);
      for (const child of children) {
        await this.cloneRecursive(child, newDir);
      }
    }
  }

  async getMetanetNode(txid: string) {
    const query = {
      "q": {
          "find": {
              "node.tx": txid
          },
          "project": {
              "node": 1,
              "out": 1,
              "out.s4": 1,
              "out.s8": 1,
              "parent": 1
          },
          "limit": 200
      }
    };

    const b64 = Buffer.from(JSON.stringify(query)).toString('base64');
    const url = "https://metanaria.planaria.network/q/" + b64;
    const response = await fetch(url, { headers: { key: '1DzNX2LzKrmoyYVyqMG46LLknzSd7TUYYP' } });
    const json = await response.json();

    const metanet =  json.metanet[0];
    const metanetNode = {
      nodeTxId: txid,
      nodeKey: metanet.node.a,
      nodeType: metanet.out[0].s4,
      name: metanet.out[0].s8,
      parentTxId: null,
      parentKey: null
    };
    if (metanet.out[0].s8) {
      metanetNode.name = metanet.out[0].s8;
    } else {
      metanetNode.name = metanet.out[0].s4;
    }
    if (metanet.parent) {
      metanetNode.parentTxId = metanet.parent.tx;
      metanetNode.parentKey = metanet.parent.a;
    }
    return metanetNode;
  }

  async getChildNodes(txid: string) {
    const query = {
      "q": {
          "find": {
              "parent.tx": txid
          },
          "project": {
              "node": 1,
              "out": 1,
              "out.s4": 1,
              "out.s8": 1
          },
          "limit": 200
      }
    };

    const b64 = Buffer.from(JSON.stringify(query)).toString('base64'); //btoa(JSON.stringify(query))
    const url = "https://metanaria.planaria.network/q/" + b64;
    const response = await fetch(url, { headers: { key: '1DzNX2LzKrmoyYVyqMG46LLknzSd7TUYYP' } });
    const json = await response.json();

    const children = [];

    for (const metanet of json.metanet) {
      const metanetNode = {
        nodeTxId: metanet.node.tx,
        nodeKey: metanet.node.a,
        nodeType: metanet.out[0].s4,
        name: metanet.out[0].s8,
      };
      if (metanet.out[0].s8) {
        metanetNode.name = metanet.out[0].s8;
      } else {
        metanetNode.name = metanet.out[0].s4;
      }
      children.push(metanetNode);
    }
    return children;
  }

  async getFileData(txid: string): Promise<Buffer> {
    const metanetNode = {
      txid: txid,
      parts: [],
      publicKey: '',
      parentTx: '',
      type: '',
      data: null,
      mediaType: '',
      encoding: '',
      name: ''
    };

    const result = await this.bitindex.tx.get(txid);
    // Get the opReturn
    const vout = result.vout.find(out => 'scriptPubKey' in out && out.scriptPubKey.type === 'nulldata');
    if (vout) {
      metanetNode.parts = this.parseOpReturn(vout.scriptPubKey.hex);

      // Verify OP_RETURN
      if (metanetNode.parts[0].toLowerCase() !== '6a') {
        throw 'Script of type nulldata is not an OP_RETURN';
      }

      // Verify metanet tag
      if (this.fromHex(metanetNode.parts[1]) !== 'meta') {
        throw 'OP_RETURN is not of type metanet';
      }

      metanetNode.publicKey = this.fromHex(metanetNode.parts[2]);
      metanetNode.parentTx = this.fromHex(metanetNode.parts[3]);
      metanetNode.type = this.fromHex(metanetNode.parts[4]);

      if (metanetNode.type === this.bFileType) {
        // Interpret B file
        metanetNode.data = Buffer.from(metanetNode.parts[5], 'hex');
        metanetNode.mediaType = this.fromHex(metanetNode.parts[6]);
        metanetNode.encoding = this.fromHex(metanetNode.parts[7]);
        metanetNode.name = this.fromHex(metanetNode.parts[8]);

        // gunzip if necessary
        if (metanetNode.encoding === 'gzip') {
          metanetNode.data = gunzipSync(metanetNode.data);
        }
      } else if (metanetNode.type === this.bcatProtocol) {
        metanetNode.data = await this.getBcatData(metanetNode);
      } else {
        metanetNode.name = metanetNode.type;
      }
    }
    return metanetNode.data;
  }

  async getBcatData(metanetNode) {
    const buffers = [];
    // Bcat parts start at index 10
    let i = 10;
    let txId;
    while (i < metanetNode.parts.length && (txId = this.fromHex(metanetNode.parts[i++])).length === 64) {
      console.log(`\tFetching part ${i-10}: ${txId}.`);
      const response = await fetch(`https://bico.media/${txId}`);
      buffers.push(await response.buffer());
    }
    return Buffer.concat(buffers);
  }

  fromHex(s: string): string {
    return Buffer.from(s, 'hex').toString('utf8');
  }

  // Returns each part as hex string (e.g. 'abcdef')
  parseOpReturn(hex) {
    const parts = [];
    // First part is op return
    parts.push(hex[0] + hex[1]);
    let index = 2;
    while (index < hex.length) {
      // Get the length
      let lengthHex = hex[index] + hex[index + 1];
      index += 2;
      // Convert length to decimal
      let length = parseInt(lengthHex, 16);
      if (length === 76) {
        // Next 1 byte contains the length
        lengthHex = hex.substring(index, index + 2);
        length = parseInt(lengthHex, 16);
        index += 2;
      } else if (length === 77) {
        // Next 2 bytes contains the length, little endian
        lengthHex = '';
        for (let i = 0; i < 2; i++) {
          lengthHex = hex[index + i * 2] + hex[index + i * 2 + 1] + lengthHex;
        }
        length = parseInt(lengthHex, 16);
        index += 4;
      } else if (length === 78) {
        // Next 4 bytes contains the length, little endian
        lengthHex = '';
        for (let i = 0; i < 4; i++) {
          lengthHex = hex[index + i * 2] + hex[index + i * 2 + 1] + lengthHex;
        }
        length = parseInt(lengthHex, 16);
        index += 8;
      }

      let data = '';
      // Read in data
      for (let i = 0; i < length; i++) {
        data += hex[index] + hex[index + 1];
        index += 2;
      }
      parts.push(data);
    }
    return parts;
  }
}

export const clone = new Clone();
