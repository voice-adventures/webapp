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

  function findCharacterLines(character_name, game){
    var lines = []
    var character = game.items.find(i => i.name === character_name)
    var talk_to = character.actions.find(a => a.name === "talk to")
    if(talk_to){
      lines = lines.concat(talk_to.script)
      lines = lines.concat(talk_to.greeting)
      lines = lines.concat(talk_to.goodbye)
    }
    for(var topic of character.topics){
      lines = lines.concat(topic.response)
      // lines = lines.concat(getCharacterLinesFromScript(topic.script, character_name))
    }
    for(var combination of game.combinations){
      if(combination.objects.contains(character_name)){
        lines = lines.concat(getCharacterCombinationLines(character_name, combination))
      }
    }
    lines = lines.concat(getCharacterLinesFromAllScripts(character_name, game))
    // scripts where play is assigned to character
    return lines
  }

  function getLinesFromScript(script){
    //find play
    var strings = findSpeakableStringsInScript(script)
    var lines = strings.map(s => {return {text: s, audio: ""} })
    return lines
    //return []
  }

  function getCharacterLinesFromScript(character, script){
    //find play
    var strings = findSpeakableStringsInScript(script)
    var lines = strings.map(s => {return {text: s, audio: ""} })
    return lines
    //return []
  }

  function getCharacterLinesFromScript(c, game){
    //find play
    var lines = []
    return lines
    //return []
  }

  function getNarratorCombinationLines(combination){
    return []
  }

  function getCharacterCombinationLines(character, combination){
    return []
  }

  function findNarratorLines(game){
    var lines = []
    for(var part of game){
      lines = lines.concat(part.intro)
      for(var scene of part.scenes){
        lines.push({text: scene.name, audio: scene.nameAudio})
        lines = lines.concat(scene.intro)
        lines = lines.concat(scene.exits)
        lines = lines.concat(getLinesFromScript(scene.script))
      }
    }
    for(var item of game.items){
      lines.push(item.inventory)
      lines.push(item.inSceneDescription)
      lines = lines.concat(items.description)
      lines = lines.concat(items.combinationFailure)
      for(var action of item.actions){
        if(action.name !== "talk to"){
          lines = lines.concat(getLinesFromScript(action.script))
          lines = lines.concat(action.failure)
        }else{
          lines = lines.concat(action.failure)
        }
      }
      for(var topic of item.topics){
        lines.push(topic.list)
      }
    }

    for(var combination of game.combinations){
        lines = lines.concat(getNarratorCombinationLines(combination))
    }
    for (var key in game.defaultResponses){
      lines = lines.concat(game.defaultResponses[key])
    }
    return lines
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
