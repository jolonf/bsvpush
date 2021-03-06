
;(() => {

  const bFileType = '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut'
  const bcatProtocol = '15DHFxWZJT58f9nhyGnsRBqrgwK4W6h4Up'

  window.addEventListener('load', () => {
    const url = new URL(window.location)
    if (url.searchParams.has('tx')) {
      // Display a metanet node
      displayMetanetNode(url.searchParams.get('tx'))
    } else {
      // Show home page
      document.querySelector('#repos').style.display = 'block'

      document.querySelector('#featured-tab').addEventListener('click', () => {
        document.querySelector('#featured-tab').classList.add('tab-selected')
        document.querySelector('#recent-tab').classList.remove('tab-selected')
        displayFeatured()
      })

      document.querySelector('#recent-tab').addEventListener('click', () => {
        document.querySelector('#recent-tab').classList.add('tab-selected')
        document.querySelector('#featured-tab').classList.remove('tab-selected')
        displayRepos()
      })

      displayFeatured()
    }

    document.querySelector('#search-button').addEventListener('click', () => {
      window.location.search = 'tx=' + document.querySelector('#search-input').value
    })
  })
  
  async function displayFeatured() {
    const featuredTransactions = [
      '21a58fae8d01df0b33f34e82e1ef30e49ad474e91890e027e926f88af15b9939', // bsvpush
      'a3663b6d8ef3d9b49e29152b60c5cadd9e2e673d90c12e029918028582fa3a17', // connect4
      'a508bb614add6a66ba14b05794c9ae98afb34675a26d591dced88221c5ca4d03' // bcat-client-stream
    ]
    displayRepos(featuredTransactions)
  }

  /**
   * Find recent 'bsvpush.json' files and return the parents which are the repos.
   * If repos is specified then filters by those parent txids.
   */
  async function displayRepos(repos) {
    const query = {
      "q": {
          "limit": 50,
          "find": {
              "out.s8": "bsvpush.json"
          },
          "sort": {
            "blk.i": -1
          },
          "project": {
              "node": 1,
              "out.s3": 1,
              "out.s4": 1,
              "out.s5": 1,
              "out.s8": 1,
              "parent": 1
          }
      }
    }

    if (repos) {
      query.q.find['parent.tx'] = {
        "$in": repos
      }
    }

    const b64 = btoa(JSON.stringify(query))
    const url = "https://metanaria.planaria.network/q/" + b64
    const response = await fetch(url, { headers: { key: '1DzNX2LzKrmoyYVyqMG46LLknzSd7TUYYP' } })
    const json = await response.json()

    let nodes = []

    for (const metanet of json.metanet) { 
      const bsvpushJson = JSON.parse(metanet.out[0].s5)
      if (!bsvpushJson.hidden && metanet.parent) {
        metanetNode = {
          nodeTxId: metanet.parent.tx,
          nodeKey: metanet.parent.a,
          name: bsvpushJson.name,
          description: bsvpushJson.description,
          sponsor: bsvpushJson.sponsor,
          version: bsvpushJson.version
        }
        nodes.push(metanetNode)
      }
    }

    // If there are nodes with the same public key, then remove older ones, and only keep the latest
    nodes = filterLatest(nodes)

    const tbody = document.querySelector('.repos-table tbody')
    // Remove all rows
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild)
    }
    const rowTemplate = document.querySelector('#repo-row')
    nodes.forEach(node => {
      let row = document.importNode(rowTemplate.content, true)
      row.querySelector('.name a').textContent = node.name
      row.querySelector('.name a').setAttribute('href', '?tx=' + node.nodeTxId)
      row.querySelector('.description').textContent = node.description
      row.querySelector('.version').textContent = node.version
      tbody.appendChild(row)

      if (node.sponsor) {
        // Create a moneybutton, use tr:last-child as moneybutton needs an element, whereas row is a DocumentFragment
        const moneyButtonDiv = tbody.querySelector('tr:last-child #node-money-button')
        const defaults = {
          amount: "1",
          currency: "USD",
          label: "Tip",
          clientIdentifier: "3fb24dea420791729b4d9b39703c6339",
          buttonId: node.nodeTxId,
          buttonData: "{}",
          type: "tip"
        }
        moneyButton.render(moneyButtonDiv, Object.assign(defaults, node.sponsor))
      }
    })
  }

  /**
   * For nodes with the same public key only returns the first.
   * @param {*} nodes 
   */
  function filterLatest(nodes) {
    const visited = []
    return nodes.filter(node => {
      if (visited.find(n => n.nodeKey == node.nodeKey)) {
        return false
      }
      visited.push(node)
      return true
    })
  }

  async function displayMetanetNode(txid) {
    const metanetNode = await getMetanetNode(txid)
    if (!metanetNode.nodeKey) {
      console.log('Not a metanet transaction');
      return;
    }
    console.log(`Metanet Node public key: ${metanetNode.nodeKey}`)
    console.log(`Metanet Node parent txid: ${metanetNode.parentTxId}`)

    document.querySelector('#metanet-node').style.display = 'block'

    document.querySelector('span#node-name').innerHTML = metanetNode.name
    document.querySelector('span#node-txid').innerHTML = metanetNode.nodeTxId
    document.querySelector('span#node-publickey').innerHTML = metanetNode.nodeKey

    if (metanetNode.parentTxId && metanetNode.parentTxId != 'NULL') {
      document.querySelector('a#parent-back').setAttribute('href', '?tx=' + metanetNode.parentTxId)
      document.querySelector('a#parent-back').style.display = 'inline'
    }

    displayChildren(metanetNode.nodeTxId)
    document.querySelector('#clone input').value = `bsvpush clone ${metanetNode.nodeTxId}`
    displayFile(metanetNode)
    document.querySelector('#spinner').style.display = 'none'
  }

  async function displayChildren(txId) {
    const children = await getChildNodes(txId)
    // sort children alphabetically
    children.sort((a, b) => a.name < b.name ? -1 : 1)

    const tbody = document.querySelector('.children-table tbody')
    const rowTemplate = document.querySelector('#node-row')

    children.forEach(child => {
      const row = document.importNode(rowTemplate.content, true)
      row.querySelector('.name a').textContent = child.name
      row.querySelector('.name a').setAttribute('href', '?tx=' + child.nodeTxId)
      row.querySelector('.txid').textContent = child.nodeTxId
      tbody.appendChild(row)
    })
    
    if (children.length === 0) {
      document.querySelector('.children-table').style.display = 'none'
    }

    document.querySelector('#metanet-node').style.display = 'block'

    displayReadme(children)
    displayMoneyButton(children)
  }

  async function displayReadme(children) {
    // Check for readme.md and display
    const readme = children.find(c => c.name.toLowerCase() == 'readme.md')
    if (readme) {
      // Get the readme data
      const md = (await getFileData(readme.nodeTxId)).toString()
      showdown.setFlavor('github')
      const converter = new showdown.Converter()
      document.querySelector('#readme').innerHTML = converter.makeHtml(md)
      document.querySelector('#readme').style.display = 'block'
    }
  }

  async function displayMoneyButton(children) {
    // Check for bsvpush.json
    const bsvpushData = children.find(c => c.name.toLowerCase() == 'bsvpush.json')
    if (bsvpushData) {
      // Get the json file
      console.log('getting bsvpush.json')
      const json = (await getFileData(bsvpushData.nodeTxId)).toString()
      const data = JSON.parse(json)
      if (data.version) {
        document.querySelector('#node-version').textContent = data.version
      }
      if (data.sponsor) {
        // Create a moneybutton
        const moneyButtonDiv = document.querySelector('#node-money-button')
        const defaults = {
          amount: "1",
          currency: "USD",
          label: "Tip",
          clientIdentifier: "3fb24dea420791729b4d9b39703c6339",
          buttonId: bsvpushData.nodeTxId,
          buttonData: "{}",
          type: "tip",
          editable: true
        }
        moneyButton.render(moneyButtonDiv, Object.assign(defaults, data.sponsor))
      }
    }
  }

  async function displayFile(metanetNode) {
    // If this is a B:// or B://cat file then get the data and display it
    if (metanetNode.nodeType == bFileType || metanetNode.nodeType == bcatProtocol) {
      const fileData = await getFileData(metanetNode.nodeTxId)
      const imgFileExts = ['.png', '.gif', '.jpg', '.jpeg']
      console.log('metanode name: ' + metanetNode.name)
      if (imgFileExts.find(e => metanetNode.name.endsWith(e))){
        console.log('img data')
        // Image
        const blob = new Blob([fileData])
        const url = URL.createObjectURL(blob)
        document.querySelector('#img-data').src = url
        document.querySelector('#img-data-container').style.display = 'block'
      } else {
        console.log('text data')
        console.log(`encoding: ${metanetNode.encoding}`)
        // Text
        textData = bsv.deps.Buffer.from(fileData).toString()
        const textNode = document.createTextNode(textData)
        document.querySelector('pre#text').appendChild(textNode)
        hljs.highlightBlock(document.querySelector('div#file-data'));
        document.querySelector('pre#text').style.display = 'block'
      }
      document.querySelector('div#file-data').style.display = 'block'
    }
  }

  /**
   * Creates an object representing a metanet node from a transaction.
   * Will interpret B files.
   * @param {*} txid 
   * @returns 
   */
  async function getMetanetNode(txid) {
    const query = {
      "q": {
          "find": {
              "tx.h": txid
          },
          "project": {
              "out": 1,
              "out.s2": 1, // Node address
              "out.s3": 1, // Parent tx
              "out.s4": 1, // B File protocol
              "out.s7": 1, // Encoding
              "out.s8": 1, // File name
          }
      }
    }

    const b64 = btoa(JSON.stringify(query))
    const url = "https://metanaria.planaria.network/q/" + b64
    const response = await fetch(url, { headers: { key: '1DzNX2LzKrmoyYVyqMG46LLknzSd7TUYYP' } })
    const json = await response.json()

    let metanetNode = {}

    if (json.metanet.length > 0) { 
      const metanet =  json.metanet[0]
      metanetNode = {
        nodeTxId: txid,
        nodeKey: metanet.out[0].s2,
        nodeType: metanet.out[0].s4,
        name: metanet.out[0].s8,
        encoding: metanet.out[0].s7
      }
      if (metanet.out[0].s8) {
        metanetNode.name = metanet.out[0].s8
      } else {
        metanetNode.name = metanet.out[0].s4
      }
      metanetNode.parentTxId = metanet.out[0].s3
    }
    return metanetNode;
  };

  async function getChildNodes(txid) {
    const query = {
      "q": {
          "find": {
              "out.s3": txid // Parent tx
          },
          "project": {
              "tx.h": 1,
              "out": 1,
              "out.s4": 1, // B File protocol
              "out.s8": 1 // File name
          },
          "limit": 200
      }
    }

    const b64 = btoa(JSON.stringify(query))
    const url = "https://metanaria.planaria.network/q/" + b64
    const response = await fetch(url, { headers: { key: '1DzNX2LzKrmoyYVyqMG46LLknzSd7TUYYP' } })
    const json = await response.json()
    
    const children = []

    for (const metanet of json.metanet) { 
      metanetNode = {
        nodeTxId: metanet.tx.h,
        /*nodeKey: metanet.node.a,*/
        nodeType: metanet.out[0].s4,
        name: metanet.out[0].s8,
      }
      if (metanet.out[0].s8) {
        metanetNode.name = metanet.out[0].s8
      } else {
        metanetNode.name = metanet.out[0].s4
      }
      children.push(metanetNode)
    }
    return children;
  }

  async function getFileData(txid) {
    console.log(`Getting file data`)
    const metanetNode = {txid: txid}
    const result = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/hash/${txid}`)).json()

    // Get the opReturn
    const vout = result.vout.find(vout => 'scriptPubKey' in vout && (vout.scriptPubKey.type == 'nulldata' || vout.scriptPubKey.type == 0))
    if (vout) {
      metanetNode.parts = parseOpReturn(vout.scriptPubKey.hex)

      // Verify OP_RETURN
      if (metanetNode.parts[0].toLowerCase() != '6a') throw 'Script of type nulldata is not an OP_RETURN'

      // Verify metanet tag
      if (fromHex(metanetNode.parts[1]) != 'meta') throw 'OP_RETURN is not of type metanet'

      metanetNode.publicKey = fromHex(metanetNode.parts[2])
      metanetNode.parentTx = fromHex(metanetNode.parts[3])
      metanetNode.type = fromHex(metanetNode.parts[4])

      console.log(`type = ${metanetNode.type}`)

      if (metanetNode.type == bFileType) {
        // Interpret B file
        metanetNode.data = metanetNode.parts[5]
        metanetNode.mediaType = fromHex(metanetNode.parts[6])
        metanetNode.encoding = fromHex(metanetNode.parts[7])
        metanetNode.name = fromHex(metanetNode.parts[8])

        // Decode from hex and gunzip if necessary
        metanetNode.data = bsv.deps.Buffer.from(metanetNode.data, 'hex')
        if (metanetNode.encoding === 'gzip') {
          const gunzip = new Zlib.Gunzip(metanetNode.data)
          metanetNode.data = bsv.deps.Buffer.from(gunzip.decompress())
        }
      } else if (metanetNode.type == bcatProtocol) {
        metanetNode.data = await getBcatData(metanetNode)
      } else {
        metanetNode.name = metanetNode.type
      }
    }
    return metanetNode.data
  }

  async function getBcatData(metanetNode) {
    console.log(`Getting bcat data, parts.length = ${metanetNode.parts.length}`)
    const arrayBuffers = []
    // Bcat parts start at index 10
    let i = 10
    let txId
    while (i < metanetNode.parts.length && (txId = fromHex(metanetNode.parts[i++])).length == 64) {
      console.log(`Fetching part ${i-10}: ${txId}.`)
      const response = await fetch(`https://bico.media/${txId}`)
      arrayBuffers.push(await response.arrayBuffer())
    }
    const blob = new Blob(arrayBuffers)
    const arrayBuffer = await new Response(blob).arrayBuffer()
    return bsv.deps.Buffer.from(arrayBuffer)
  }

  // Returns each part as hex string (e.g. 'abcdef')
  function parseOpReturn(hex) {
    let parts = []
    // First part is op return
    parts.push(hex[0] + hex[1])
    let index = 2;
    while (index < hex.length) {
      // Get the length
      let lengthHex = hex[index] + hex[index + 1]
      index += 2
      // Convert length to decimal
      let length = parseInt(lengthHex, 16)
      if (length == 76) {
        // Next 1 byte contains the length
        lengthHex = hex.substring(index, index + 2)
        length = parseInt(lengthHex, 16)
        index += 2
      } else if (length == 77) {
        // Next 2 bytes contains the length, little endian
        lengthHex = ''
        for (let i = 0; i < 2; i++) {
          lengthHex = hex[index + i * 2] + hex[index + i * 2 + 1] + lengthHex
        }
        length = parseInt(lengthHex, 16)
        index += 4
      } else if (length == 78) {
        // Next 4 bytes contains the length, little endian
        lengthHex = ''
        for (let i = 0; i < 4; i++) {
          lengthHex = hex[index + i * 2] + hex[index + i * 2 + 1] + lengthHex
        }
        length = parseInt(lengthHex, 16)
        index += 8
      }

      let data = ''
      // Read in data
      for (let i = 0; i < length; i++) {
        data += hex[index] + hex[index + 1]
        index += 2
      }
      parts.push(data)
    }
    return parts
  }

  // https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
  function fromHex(hex){
    let str
    try {
        uriComponent = hex.replace(/(..)/g,'%$1')
        //console.log(`uriComponent`, uriComponent)
        str = decodeURIComponent(uriComponent)
    } catch(e) {
        str = hex
        console.log('invalid hex input: ' + hex)
        console.log(e)
    }
    return str
  }  

  function toHex(str){
    let hexß
    try {
        hex = unescape(encodeURIComponent(str)).split('').map(function(v){
            return v.charCodeAt(0).toString(16)
        }).join('')
    } catch(e) {
        hex = str
        console.log('toHex: Invalid text input: ' + str)
    }
    return hex
  }

  /**
   * Hex string to bytes.
   * @param {*} hex 
   */
  function hexToUint8Array(hex) {
    const bytes = new Uint8Array(hex.length / 2)

    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex[i * 2] + hex[i * 2 + 1], 16)
    }

    return bytes
  }

})()

