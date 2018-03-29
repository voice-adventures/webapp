const fs = require('fs')

function TextGetter(filename) {
  return {
    findSpeakableStrings,
    findSpeakable
  }

  function findSpeakableStrings() {
    return findSpeakableStringsInObject(JSON.parse(fileContents()))
  }

  function findSpeakable(o){
    return [...new Set(findSpeakableStringsInObject(o))]

  }

  function findSpeakableStringsInObject(o) {
    let results = []
    Object.keys(o).forEach(k => {


      if (k === 'script') {
        results.push(...findSpeakableStringsInScript(o[k]))
      }

      switch (typeOf(o[k])) {
        case 'string':
        if (k === 'audio'
          || k === 'name'
          || k === 'id'
          || k === 'order'
          || k === 'aliases'
          || isNumeric(k)) break


        if (k === 'script') {
          results.push(...findStringLiterals(o[k]))
          break
        }

        results.push(o[k])
        break

        case 'object':
        results.push(...findSpeakableStringsInObject(o[k]))
        break

        case 'array':
        results.push(...findSpeakableStringsInObject(o[k]))
        break
      }
    })

    return results
  }

  function findSpeakableStringsInScript(script) {
    return findStringLiterals(script)
  }

  function fileContents() {
    return fs.readFileSync(filename).toString()
  }


}



function typeOf(thing) {
  let description = Object.prototype.toString.call(thing)
  return description.slice('[object '.length, -1).toLowerCase()
}

function isNan(n) {
  return n !== n
}

function isNumeric(n) {
  return !isNan(parseInt(n))
}

function findStringLiterals(script) {
  let jsStrings = (script || '').match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g) || []
  return jsStrings.map(s => {
    try {
      return eval(s)
    } catch(e) {
      console.log('ERROR:', s)
    }
    return ''
  }).filter(s => s)
}


module.exports = {
  findStringLiterals,
  TextGetter,
  typeOf
}
