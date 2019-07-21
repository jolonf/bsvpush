# bsvpush
> Push files to the metanet

Bsvpush will upload a directory tree of files to the BSV blockchain using metanet nodes. Bsvpush can also be used to clone repositories off the blockchain.

Be careful using bsvpush as once your files are on the blockchain they can't be removed!

# Install

```
npm install -g bsvpush
```

# Usage

## Clone
To clone an existing repository, use the transaction id of the root parent node of the repository:

```
bsvpush clone a508bb614add6a66ba14b05794c9ae98afb34675a26d591dced88221c5ca4d03
```

Find and view repositories at [codeonchain.network](https://codeonchain.network).

## Init

Before pushing a repository you must run ```bsvpush init``` in the root directory of the project to create several files and directories:

```
bsvpush init
```

The following directories and files will be generated:

```
HOME/.bsvpush/funding_key
~/.bsvpush/metanet.json
~/.bsvignore
~/bsvpush.json
```

It will also add ```.bsvpush``` to ```.gitignore``` as ```.bsvpush``` contains the master private key of the repository and must not be uploaded to the blockchain.

### Funding Key

To push files to the blockchain you will need to fund the transactions. Bsvpush requires you to provide a wallet private key. Do not use your main wallet, create a separate wallet and transfer a small amount to it for file uploads.

```bsvpush init``` creates a ```funding_key``` file in ```HOME/.bsvpush```, which contains the following:

```json
{
  "xprv": "xprv...",
  "derivationPath": "m/0/0"
}
```

You will need to obtain the xprv private key from your wallet. The derivation path ```m/0/0``` is what is used by the ElectrumSV wallet.

### .bsvignore

Be very careful about what you upload to the blockchain. Bsvpush will list all files that will be uploaded and ask you to confirm before uploading. The .bsvignore file can be used to ignore files. Note that it is an exact match at the moment.

### bsvpush.json

```bsvpush.json``` describes the repository being uploaded. Here is an example of the contents:

```json
{
  "name": "bsvpush",
  "owner": "jolon",
  "description": "Push files to metanet",
  "sponsor": {
    "to": "jolon@moneybutton.com"
  },
  "version": "0.0.1"
}
```

The properties should be self explanatory. The ```sponsor``` property is used to create a moneybutton. The properties of the ```sponsor``` property should be compatible with moneybutton and should be able to be applied directly to the moneybutton configuration object. This allows for more complex transactions such as sending to multiple accounts, which can be used to support projects that your project may rely on.

## Push

To begin the upload run:

```
bsvpush push
```

Bsvpush will first navigate the directory structure, ignoring any files that match the files listed in ```.bsvignore```, and estimate the fees for each file. Before uploading it will provide an overall funding estimate so that you can ensure you have the funds in your funding wallet. Bsvpush will confirm with you before sending any transactions.

If you enter ```Y```, bsvpush will first fund all of the transactions. This will be performed using a single transaction which will have many outputs, one for each transaction required for each metanet node. Bsvpush will wait until the funding transaction has been confirmed. This will take several minutes. Once it is confirmed it will send through all of the individual transactions. Bsvpush will not wait for these to be confirmed. The transaction ids will be listed as they are sent and you can view them in [codeonchain.network](https://codeonchain.network).

