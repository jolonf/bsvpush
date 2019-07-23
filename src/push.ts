import fs from 'fs';
import path from 'path';
import readline from 'readline-promise';

import BitIndexSDK from 'bitindex-sdk';

import { MetanetCache } from './metanet_cache';
import { MetanetNode } from './metanet_node';

const bsv = require('bsv');
const bitindex = new BitIndexSDK();

/**
 * Recurses current directory and pushes all directories and files to the metanet.
 * Files/dir listed in .bsvignore will be ignored (currently only exact match).
 */
export class Push {
  fee = 400;
  feeb = 1.1;
  minimumOutputValue = 546;

  private _packageInfo;
  get packageInfo() {
    if (!this._packageInfo) {
      const packgeInfoPath = path.join(process.cwd(), 'bsvpush.json');
      try {
        this._packageInfo = JSON.parse(fs.readFileSync(packgeInfoPath).toString());
      } catch (error) {
        console.log(error, 'Error loading bsvpush.json: ' + packgeInfoPath);
        console.log('Try: bsvpush init');
        process.exit(1);
      }
    }
    return this._packageInfo;
  }

  private _metanetCache: MetanetCache;
  get metanetCache(): MetanetCache {
    if (!this._metanetCache) {
      const metanetCachePath = path.join(process.cwd(), '.bsvpush', 'metanet.json');
      try {
        this._metanetCache = new MetanetCache(JSON.parse(fs.readFileSync(metanetCachePath).toString()));
        this._metanetCache.root.name = this.packageInfo.name;
      } catch (error) {
        console.log(error, 'Error loading master key from: ' + metanetCachePath);
        console.log('Try: bsvpush init');
        process.exit(1);
      }
    }
    return this._metanetCache;
  }

  private _fundingKey;
  get fundingKey() {
    if (!this._fundingKey) {
      const fundingKeyPath = path.join(process.env.HOME, '.bsvpush', 'funding_key');
      try {
        const funding = JSON.parse(fs.readFileSync(fundingKeyPath).toString());
        this._fundingKey = bsv.HDPrivateKey(funding.xprv).deriveChild(funding.derivationPath);
      } catch(error) {
        console.log(error, 'Error loading funding key from: ' + fundingKeyPath);
        process.exit(1);
      }
    }
    return this._fundingKey;
  }

  private _ignoreList: string[];
  get ignoreList() {
    if (!this._ignoreList) {
      const ignorePath = path.join(process.cwd(), '.bsvignore');
      if (fs.existsSync(ignorePath)) {
        const ignoreText = fs.readFileSync(ignorePath).toString();
        this._ignoreList = ignoreText.split('\n').map(line => line.trim());
      } else {
        this._ignoreList = [];
      }
    }
    return this._ignoreList;
  }

  ignore(file: string): boolean {
    return this.ignoreList.some(ignoreExp => ignoreExp === file);
  }

  /**
   * Creates any directories and files used by bsvpush if they don't already exist.
   * .bsvpush
   * .bsvpush/metanet.json
   * .bsvpush.json
   * HOME/.bsvpush
   * HOME/.bsvpush/funding_key
   *
   * Appends .bsvpush directory to .gitignore as a safety measure, as .bsvpush/metanet.json
   * includes the metanet master private key.
   */
  init() {
    const bsvignore = path.join(process.cwd(), '.bsvignore');
    if (!fs.existsSync(bsvignore)) {
      console.log(`Creating: ${bsvignore}`);
      const contents = `.bsvpush
.git`;
      fs.writeFileSync(bsvignore, contents);
    }

    const bsvpushDir = path.join(process.cwd(), '.bsvpush');
    if (!fs.existsSync(bsvpushDir)) {
      console.log(`Creating: ${bsvpushDir}`);
      fs.mkdirSync(bsvpushDir);
    }

    const metanet = path.join(bsvpushDir, 'metanet.json');
    if (!fs.existsSync(metanet)) {
      console.log(`Creating: ${metanet}`);
      const masterKey = bsv.HDPrivateKey();
      const json = {
        masterKey: masterKey.xprivkey,
        root: {
          keyPath: 'm/0',
          index: 0,
          children: {}
        }
      };
      fs.writeFileSync(metanet, JSON.stringify(json, null, 2));
    }

    const bsvpush = path.join(process.cwd(), 'bsvpush.json');
    if (!fs.existsSync(bsvpush)) {
      console.log(`Creating: ${bsvpush}`);
      const json = {
        name: "",
        owner: "",
        description: "",
        sponsor: { to: "" },
        version: "",
        hidden: false
      };
      fs.writeFileSync(bsvpush, JSON.stringify(json, null, 2));
    }

    const bsvpushHomeDir = path.join(process.env.HOME, '.bsvpush');
    if (!fs.existsSync(bsvpushHomeDir)) {
      console.log(`Creating: ${bsvpushHomeDir}`);
      fs.mkdirSync(bsvpushHomeDir);
    }

    const fundingKey = path.join(bsvpushHomeDir, 'funding_key');
    if (!fs.existsSync(fundingKey)) {
      console.log(`Creating: ${fundingKey}`);
      const json = {
        xprv: '',
        derivationPath: 'm/0/0'
      };
      fs.writeFileSync(fundingKey, JSON.stringify(json, null, 2));
    }

    // Add .bsvpush directory to .gitignore
    // This is a safety measure as .bsvpush contains the master private key
    console.log(`Adding .bsvpush to .gitignore`);
    const gitIgnore = path.join(process.cwd(), '.gitignore');
    if (!fs.existsSync(gitIgnore)) {
      fs.writeFileSync(gitIgnore, ".bsvpush");
    } else {
      fs.appendFileSync(gitIgnore, "\n.bsvpush");
    }
  }

  /**
   * Ensure all required files exist, if not exit.
   */
  preflight() {
    const paths = [
      path.join(process.env.HOME, '.bsvpush'),
      path.join(process.env.HOME, '.bsvpush', 'funding_key'),
      path.join(process.cwd(), '.bsvpush'),
      path.join(process.cwd(), '.bsvpush', 'metanet.json'),
      path.join(process.cwd(), '.bsvignore'),
      path.join(process.cwd(), 'bsvpush.json')
    ];

    const pathsDontExist = [];

    paths.forEach(p => {
      if (!fs.existsSync(p)) {
        pathsDontExist.push(p);
      }
    });
    if (pathsDontExist.length > 0) {
      const s = pathsDontExist.length > 1 ? 's' : '';
      console.log(`Cannot find the following file${s}: `);
      pathsDontExist.forEach(p => console.log(`\t${p}`));
      console.log(`Run: bsvpush init`);
      process.exit(1);
    }
  }

  /**
   * Pushes the current directory to metanet.
   * Asks the user before sending the transactions.
   */
  async push() {
    // Ensure config files exist
    this.preflight();

    const fees = this.generateScripts(process.cwd(), this.metanetCache.root, null);

    const fundingTx = await this.fundingTransaction(fees, this.metanetCache.root);

    const metanetFees = fees.reduce((sum, entry) => sum + entry.fee, 0);
    const fundingTxFee = Math.max(Math.ceil(fundingTx._estimateSize() * this.feeb), this.minimumOutputValue);
    const totalFee = metanetFees + fundingTxFee;

    console.log(`Metanet fees will be: ${this.feeToString(metanetFees)}`);
    console.log(`Funding transaction fee will be: ${this.feeToString(fundingTxFee)}`);
    console.log(`Total: ${this.feeToString(totalFee)}`);

    const rlp = readline.createInterface({input: process.stdin, output: process.stdout});
    const input = await rlp.questionAsync(`Continue (Y/n)?`);
    rlp.close();

    if (input !== 'n' && input !== 'N') {
      console.log(`Sending funding transaction: ${fundingTx.id}`);
      const response = await bitindex.tx.send(fundingTx.toString());
      if (!response.txid) {
        console.log('Error sending funding transaction.');
        console.log(response);
        process.exit(1);
      }
      await this.waitForConfirmation(fundingTx.id);
      //await this.waitForParentUTXOs(fees);
      await this.sendMetanetTransactions(fundingTx, null, this.metanetCache.root);
      fs.writeFileSync(path.join(process.cwd(), '.bsvpush', 'metanet.json'), JSON.stringify(this.metanetCache.toJSON(), null, 2));
      console.log(`\nRepository uploaded, view at: https://codeonchain.network?tx=${fundingTx.id}`);
    }
  }

  feeToString(fee: number): string {
    return `${fee} satoshis (${fee / 1e8} BSV)`;
  }

  /**
   * Stages the specified directory by generating the transaction and estimating the fees.
   * Also stages all children of the directory.
   * @param dir parent directory (not the directory of the node).
   * @param node node representing this directory.
   * @param parent node representing parent.
   */
  generateScripts(dir: string, node: MetanetNode, parent: MetanetNode, fees = []) {
    this.dirScript(node, parent); // Stage this node as a directory, then process children
    this.estimateFee(node);
    console.log(`[${node.keyPath}] ${dir} (${node.fee} satoshis)`);

    // Root node is not included in the split funding transaction as it is funded directly
    // from the funding key
    if (parent) {
      fees.push({parentKeyPath: parent.keyPath, fee: node.fee});
    }

    const files = fs.readdirSync(dir, {withFileTypes: true});
    for (const file of files) {
      if (!this.ignore(file.name)) {
        if (file.isDirectory()) {
          let child = node.child(file.name);
          if (!child) {
            child = node.addChild(file.name);
          }
          child.dir = dir;
          child.voutIndex = fees.length + 1;
          this.generateScripts(path.join(dir, file.name), child, node, fees);
        } else {
          const child = this.fileScript(dir, file.name, node);
          child.voutIndex = fees.length + 1;
          this.estimateFee(child);
          fees.push({parentKeyPath: node.keyPath, fee: child.fee});
          console.log(`[${child.keyPath}] ${dir}/${child.name} (${child.fee} satoshis)`);
        }
      } else {
        // If the file is ignored but appears as a child then mark it for removal
        const child = node.child(file.name);
        if (child && !child.removed) {
          child.remove();
        }
      }
    }
    return fees;
  }

  /**
   * Create an OP RETURN script with the name of the directory.
   * @param child node of the directory
   * @param parent node of the parent directory
   */
  dirScript(child: MetanetNode, parent: MetanetNode) {
    const oprParts = this.opReturnMetaHeader(parent, child);
    oprParts.push(Buffer.from(child.name).toString('hex')); // Push the file name
    child.opreturn = oprParts;
  }

  /**
   * Create an OP RETURN script with the contents of the file.
   * @param dir directory where the file is located (to be able to read from the file)
   * @param name name of the file
   * @param parent parent node
   * @returns Promise to the child node
   */
  fileScript(dir: string, name: string, parent: MetanetNode): MetanetNode {
    let child = parent.child(name);
    if (!child) {
      child = parent.addChild(name);
    }
    child.dir = dir;

    const oprParts = this.opReturnMetaHeader(parent, child);
    // B:// format https://github.com/unwriter/B
    oprParts.push(Buffer.from('19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut').toString('hex')); // B://
    oprParts.push(fs.readFileSync(path.join(dir, name)).toString('hex')); // Data
    oprParts.push(Buffer.from(' ').toString('hex')); // Media Type
    oprParts.push(Buffer.from(' ').toString('hex')); // Encoding
    oprParts.push(Buffer.from(name).toString('hex')); // Filename

    child.opreturn = oprParts;
    return child;
  }

  /**
   * Creates a OP RETURN metanet header with the public key of the child
   * and the public key and transaction id of the parent node.
   * @param parent
   * @param child
   */
  opReturnMetaHeader(parent: MetanetNode, child: MetanetNode): string[] {
    const childKey = this.metanetCache.masterKey.deriveChild(child.keyPath);
    const oprParts = new Array<string>();
    oprParts.push('OP_RETURN');
    oprParts.push(Buffer.from('meta').toString('hex'));
    oprParts.push(Buffer.from(childKey.publicKey.toAddress().toString()).toString('hex'));
    const txid = (parent === null ? 'NULL' : parent.txId);
    oprParts.push(Buffer.from(txid).toString('hex'));
    return oprParts;
  }

  estimateFee(node: MetanetNode) {
    const script = bsv.Script.fromASM(node.opreturn.join(' '));
    if (script.toBuffer().length > 100000) {
      console.log(`Maximum OP_RETURN size is 100000 bytes. Script is ${script.toBuffer().length} bytes.`);
      process.exit(1);
    }

    const tempTX = new bsv.Transaction().from([this.getDummyUTXO()]);
    tempTX.addOutput(new bsv.Transaction.Output({ script: script.toString(), satoshis: 0 }));
    node.fee = Math.max(Math.ceil(tempTX._estimateSize() * this.feeb), this.minimumOutputValue);

    // Use the dummy txid for now as it will be used in the children tx size calculations
    node.txId = tempTX.id.toString();
  }

  /**
   * Creates a funding transaction from the funding key, with outputs to all of the parent keys.
   * There can be multiple outputs to a parent key. This allows multiple parent->child transactions
   * to be subsequently sent without waiting for the parent to confirm, only the funding transaction
   * must confirm, and then all of the metanet nodes transactions can be sent.
   * @param fees Array of {parentKeyPath, fee}, representing each metanet node, except for the root node
   * @param root If the root is to be updated then pass it in and it will be an output of the funding tx
   */
  async fundingTransaction(fees, root = null) {
    const fundingPublicKeyAddress = this.fundingKey.publicKey.toAddress().toString();
    const utxos = await bitindex.address.getUtxos(fundingPublicKeyAddress);

    if (utxos.length === 0) {
      throw `No UTXOs available from funding key. Add new funds to: ${fundingPublicKeyAddress}`;
    }

    const tx = new bsv.Transaction()
      .from(utxos)
      .fee(this.fee)
      .change(this.fundingKey.publicKey.toAddress());

    if (root) {
      // Add root as first output
      const script = bsv.Script.fromASM(root.opreturn.join(' '));
      tx.addOutput(new bsv.Transaction.Output({ script: script.toString(), satoshis: 0 }));
    }

    fees.forEach(entry => {
      const parentKey = this.metanetCache.masterKey.deriveChild(entry.parentKeyPath);
      tx.to(parentKey.publicKey.toAddress(), entry.fee);
    });

    const thisFee = Math.ceil(tx._estimateSize() * this.feeb);
    tx.fee(thisFee);
    tx.sign(this.fundingKey.privateKey);

    if (root) {
      root.txId = tx.id;
    }

    return tx;
  }

  /**
   * Sends the metanet transaction for the specified node and all of its children.
   * @param node
   * @param last is this the last child of the parent
   * @returns the next voutIndex from the funding transaction
   */
  async sendMetanetTransactions(fundingTx, parent: MetanetNode, node: MetanetNode, last: boolean = true) {
    console.log(`[${node.keyPath}] ${node.dir}/${node.name}`);

    // Don't send if root node, as it was already sent in the funding transaction
    if (parent) {
      const tx = await this.metanetTransaction(fundingTx, parent, node);
      console.log(`\tSending metanet transaction: ${tx.id}`);
      const response = await bitindex.tx.send(tx.toString());
      if (!response.txid) {
        console.log('Error sending transaction.');
        console.log(response);
        process.exit(1);
      }
    }

    const keys = node.getUnremovedChildKeys();
    for (const key of keys) {
      await this.sendMetanetTransactions(fundingTx, node, node.children[key], key === keys[keys.length - 1]);
    }
  }

  /**
   * Funding transaction has been sent, wait for UTXOs of all parents.
   * @param fees
   */
/*  async waitForParentUTXOs(fees: object[]) {
    // Group fees by parent
    const feesByParent = this.groupBy(fees, 'parentKeyPath');
    const keys = Object.keys(feesByParent);

    let found = false;

    while (!found) {
      let utxoCount = 0;
      for (const key of keys) {
        // Get UTXOs
        const privateKey = this.metanetCache.masterKey.deriveChild(key);
        const utxos = await bitindex.address.getUtxos(privateKey.publicKey.toAddress().toString());
        // Check if all UTXOs are satisfied
        const parentFees = feesByParent[key];
        try {
          parentFees.forEach((fee) => {
            this.filterUtxosExact(utxos, fee);
            utxoCount++;
          });
        } catch (e) {
          console.log(`[${utxoCount} / ${fees.length}] UTXOs ready`);
          // Fee not found, try again
          await this.sleep(1000);
          continue;
        }
        found = true;
      }
    }

  }*/

  /**
   * Groups the elements in the array by the element key.
   * @param a
   * @param key
   */
  groupBy(a: object[], key: string): object {
    return a.reduce((result, element) => {
      (result[element[key]] = result[element[key]] || []).push(element);
      return result;
    }, {});
  }

  async waitForConfirmation(txid: string) {
      // Wait until the transaction appears
      while (!('txid' in await bitindex.tx.get(txid))) {
        console.log('Waiting for transaction to appear...');
        await this.sleep(1000);
      }

      console.log('Waiting for transaction to be confirmed... (this could take a few minutes)');
      while (!('confirmations' in await bitindex.tx.get(txid))) {
        process.stdout.write('.');
        await this.sleep(1000);
      }
      console.log(`\nTransaction confirmed: ${txid}`);
  }

  /**
   * Creates a metanet transaction but doesn't send it.
   */
  async metanetTransaction(fundingTx, parent: MetanetNode, node: MetanetNode) {
    const parentKey = this.metanetCache.masterKey.deriveChild(parent.keyPath);
    const utxo = await this.findUtxo(parentKey.publicKey.toAddress().toString(), fundingTx.id, node.voutIndex);
    if (!utxo) {
      console.log(`Could not find a UTXO for key: ${parentKey.publicKey.toAddress().toString()}, txid: ${fundingTx.id}, vout: ${node.voutIndex}`);
      process.exit(1);
    }
    /*const utxos = [bsv.Transaction.UnspentOutput({
        address: parentKey.publicKey.toAddress().toString(),
        txId: fundingTx.id,
        outputIndex: voutIndex,
        satoshis: node.fee,
        scriptPubKey: fundingTx.outputs[voutIndex].script.toHex()
      })];*/
    const utxos = [utxo];

    // Patch in the parent's transaction id into the script which wasn't known when
    // the script was generated
    const parentTxId = (parent === null ? 'NULL' : parent.txId);
    node.opreturn[3] = Buffer.from(parentTxId).toString('hex');
    const script = bsv.Script.fromASM(node.opreturn.join(' '));

    const metaTX = new bsv.Transaction().from(utxos);
    metaTX.addOutput(new bsv.Transaction.Output({ script: script.toString(), satoshis: 0 }));
    metaTX.fee(node.fee);
    metaTX.sign(parentKey.privateKey);
    node.txId = metaTX.id;
    return metaTX;
  }

  async findUtxo(publicKey: string, txid: string, voutIndex: number) {
    const utxos = await bitindex.address.getUtxos(publicKey);
    return utxos.find(utxo => utxo.txid === txid && utxo.vout === voutIndex);
  }

  getDummyUTXO() {
    return bsv.Transaction.UnspentOutput({
      address: '19dCWu1pvak7cgw5b1nFQn9LapFSQLqahC',
      txId: 'e29bc8d6c7298e524756ac116bd3fb5355eec1da94666253c3f40810a4000804',
      outputIndex: 0,
      satoshis: 5000000000,
      scriptPubKey: '21034b2edef6108e596efb2955f796aa807451546025025833e555b6f9b433a4a146ac'
    });
  }

  filterUTXOs(utxos, satoshisRequired) {
    let total = 0;
    const res = utxos.filter((utxo, i) => {
      if (total < satoshisRequired) {
        total += utxo.satoshis;
        return true;
      }
      return false;
    });

    if (total < satoshisRequired) {
      throw new Error(`Insufficient funds (need ${satoshisRequired} satoshis, have ${total})`);
    }

    return res;
  }

  /**
   * Finds a single exact match UTXO for satoshisRequired and removes it from the utxos array.
   * @param utxos
   * @param satoshisRequired
   */
  filterUtxosExact(utxos, satoshisRequired) {
    const index = utxos.findIndex(utxo => utxo.satoshis == satoshisRequired);
    const utxo = utxos[index];
    // Remove utxo
    utxos.splice(index, 1);

    if (!utxo) {
      throw new Error(`Could not find a parent UTXO with the exact satoshis required (need ${satoshisRequired} satoshis)`);
    }

    return utxo;
  }

  sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
  }
}

export const push = new Push();
