const fs = require('fs')
const acorn = require('acorn')

var roots = ["items", "combinations", 'defaultResponses', "topics"]
function comboName(objects){
  var comb = []
  for( var n of objects){
    comb.push(n.toLowerCase().replace(/ /g, "_").replace(/\//g, "-"))
  }
  return comb.join("-")
}

function findSpeakableStringsInObject(o, character, path = []) {
  let results = []
  // let p = JSON.parse(JSON.stringify(path))
  // console.log(path)
  // if(!o) return []

  Object.keys(o).forEach(k => {
    //| !isNaN(parseInt(k)))
    switch (typeof o[k]) {
      case 'string':
        if (k === 'audio'
          || k === 'name'
          || k === 'text'
          || k === 'character'
          || k === 'id'
          || k === 'name'
          || k === 'order'
          || k === 'aliases'
          || !isNaN(k)){
            // console.log(path, k, o)
            // path.pop()
            break
          }


        if (k === 'script') {
          if(path.includes("combinations") && o.objects){
            let comb = comboName(o.objects)
            path.push(comb+ "/script")
          }else{
            path.push("script")
          }
          results.push(...findSpeakableStringsInScript(o[k], character, path))
          path.pop()
          break
        }

        //results.push(o[k])
        break

      case 'object':
        if(o[k]){
          var pushed = false
          if (roots.includes(k)){
            path.push(k)
            pushed = true
          }else{
            if(o[k].name){
              path.push(o[k].name.toLowerCase().replace(/ /g, "_").replace(/\//g, "-"))
              pushed = true
            }
          }
          results.push(...findSpeakableStringsInObject(o[k], character, path ))
          if(pushed){
            path.pop()
          }
        }
        break

      case 'array':
      // console.log("IS ARRAY!!!!!!")
        // path.push(k)
        results.push(...findSpeakableStringsInObject(o[k], character, path))
        break
    }
  })

  return results
}

function findSpeakableStringsInScript(script, character, path) {
  try{
    let ast = acorn.parse(script, {allowReturnOutsideFunction: true})
    return findAudioObjectsInAST(ast, character, path).concat(findPlayCallsInAST(ast, character, path))
  }catch(err){
    console.log(err, script)
    return []
  }
  //todo: uniq
}

function getCharacterCombinationLines(name, game) {
  let responses = []
  for (var combo of game.combinations) {
    if (combo.objects.includes(name)) {
      if(combo.responses) responses = responses.concat(addPathnames(combo.responses, ["combinations", comboName(combo.objects), "responses"]))
    }
  }
  return responses
}

function getCharacterLinesFromAllScripts(game, character) {
  return [...new Set(findSpeakableStringsInObject(game, character))]
}

function getAllCharacterLines(game){ //every line thats not the narrator
  let all_lines = {}
  for (let character of game.items) {
    all_lines[character.name] = getCharacterLines(character, game)
  }
  return all_lines
}

function findPlayCallsInAST(ast, character, path) {
  let toReturn = []
  if(ast){
    if(character){
      if (ast.type === 'CallExpression'
        && (ast.callee.name === 'play' || ast.callee.name === 'singlePlay' )
        && ast.arguments.length === 3
        && ast.arguments[2].value === character) {
        toReturn = [{
          text: ast.arguments[0].value,
          audio: ast.arguments[1].value,
          path: path.join("/")
        }]
      }
    }else{
      if (ast.type === 'CallExpression'
      && audioFunctions[ast.callee.name]
      && !((ast.callee.name === "play" || ast.callee.name === "singlePlay") && ast.arguments.length === 3) ) {
        toReturn = [{
          text: ast.arguments[audioFunctions[ast.callee.name][0]].value,
          audio: ast.arguments[audioFunctions[ast.callee.name][1]].value,
          path: path.join("/")
        }]
      }
    }
  }else{
    ast = {}
  }

  return toReturn.concat(Object.values(ast).filter(subnode => typeof subnode === 'object').map(ast => findPlayCallsInAST(ast, character, path)).reduce((a, b) => a.concat(b), []))
}

var audioFunctions = {"play": [0, 1], "singlePlay": [0, 1], "changeInventoryName": [1, 2], "addExit": [3, 4], "addSilentExit": [3, 4], "addExitAtIndex": [4,5], "changeExitDescription": [2, 3]}

function propertyIsNamed(name) {
  return function(prop) {
    return prop.key.name === name // identifier node
      || prop.key.value === name  // string literal node
  }
}

function findAudioObjectsInAST(ast, character, path) {
  let toReturn = []
  if(ast){
    if(character){
      if (ast.type === 'ObjectExpression'
        && ast.properties.some(propertyIsNamed('audio'))
        && ast.properties.some(propertyIsNamed('text'))
        && ast.properties.some(prop => propertyIsNamed('character')(prop) && prop.value.value === character)) {
          toReturn = [{
            text: ast.properties.find(propertyIsNamed('text')).value.value,
            audio: ast.properties.find(propertyIsNamed('audio')).value.value,
            path: path.join("/")}]
      }
    }else{
      if (ast.type === 'ObjectExpression'
        && ast.properties.some(propertyIsNamed('audio'))
        && ast.properties.some(propertyIsNamed('text'))
        && !ast.properties.some(prop => propertyIsNamed('character')(prop))) {
          toReturn = [{
            text: ast.properties.find(propertyIsNamed('text')).value.value,
            audio: ast.properties.find(propertyIsNamed('audio')).value.value,
            path: path.join("/")}]
      }
    }
  }else{
    ast = {}
  }
  return toReturn.concat(Object.values(ast).filter(subnode => typeof subnode === 'object').map(ast => findAudioObjectsInAST(ast, character, path)).reduce((a, b) => a.concat(b), []))
}


function getCharacterLines(character, game){
  var lines = []
  var talk_to = character.actions ? character.actions.find(a => a.name === "talk to") : false
  if(talk_to){
    lines = lines.concat(addPathnames(talk_to.greeting, ["items", character.name, "actions", "talk_to", "greeting"]))
    lines = lines.concat(addPathnames(talk_to.goodbye, ["items", character.name, "actions", "talk_to", "goodbye"]))
  }
  if(character.topics){
    for(var topic of character.topics){
      lines = lines.concat(addPathnames(topic.response, ["items", character.name, "topics", topic.name, "response"]))
    }
  }

  lines = lines.concat(getCharacterCombinationLines(character.name, game))
  lines = lines.concat(getCharacterLinesFromAllScripts(game, character.name))
  // scripts where play is assigned to character
  return lines
}


function getCharacterLinesByName(game, character_name){
  var character = game.items.find(i => i.name === character_name)
  return getCharacterLines(character, game)
}

function addPathnames(arr, path){
  if(!arr) return []
  if(!Array.isArray(arr)){
    arr.path = genPathName(path)
    return arr
  }
  for(var i = 0; i < arr.length; i++){
    var p = path.slice()
    arr[i].path = genPathName(p)
  }
  return arr

}

function genPathName(arr){
  arr = arr.map(a => a.toLowerCase().replace(/ /g, "_").replace(/\//g, "-"))
  return arr.join("/")
}

function getNarratorLines(game, character_list){
  var lines = []
  for(var part of game.parts){
    lines = lines.concat(addPathnames(part.intro,  [part.name, "intro"]))
    for(var scene of part.sceneList){
      lines.push({text: scene.name, audio: scene.nameAudio, path: genPathName([part.name, scene.name])})
      lines = lines.concat(addPathnames(scene.intro, [part.name, scene.name, "intro"]))
      for(var e of scene.exits){
        e.path = genPathName([part.name, scene.name, "exits", e.direction])
        lines.push(e)
      }
    }
  }
  for(var item of game.items){
    if(item.inventory) lines.push(addPathnames(item.inventory, ["items", item.name, "inventory"]))
    if(item.inSceneDescription) lines.push(addPathnames(item.inSceneDescription, ["items", item.name, "inSceneDescription"]))
    if(item.description) lines = lines.concat(addPathnames(item.description, ["items", item.name, "description"]))
    if(item.combinationFailure) lines = lines.concat(addPathnames(item.combinationFailure, ["items", item.name, "combinationFailure"]))
    if(item.actions){
      for(var action of item.actions){
        if(action.failure) lines = lines.concat(addPathnames(action.failure, ["items", item.name, action.name, "failure"]))
        if(action.name === "talk to"){
          lines = lines.concat(addPathnames(action.listTopics, ["items", item.name, action.name, "listTopicsIntro"]))
        }
      }
    }
    if(character_list && !character_list.includes(item.name)){
      for(var topic of item.topics){
        lines.push(addPathnames(topic.list, ["items", item.name, "topics", topic.name, "list"]))
        lines.push(addPathnames(topic.response, ["items", item.name, "topics", topic.name, "response"]))
      }
    }else{
      for(var topic of item.topics){
        lines.push(addPathnames(topic.list, ["items", item.name, "topics", topic.name, "list"]))
      }
    }
  }

  lines = lines.concat(getNarratorCombinationLines(game, character_list))
  for (var key in game.defaultResponses){
    lines = lines.concat(addPathnames(game.defaultResponses[key], ["defaultresponses", key]))
  }
  lines = lines.concat(getCharacterLinesFromAllScripts(game))
  return lines
}

function getNarratorCombinationLines(game, character_list){
  let responses = []
  for (var combo of game.combinations) {
    if(combo.responses) responses = responses.concat(addPathnames(combo.responses, ["combinations", comboName(combo.objects), "responses"]))
  }
  return responses
}


module.exports = {
  getCharacterLines,
  getCharacterLinesByName,
  getAllCharacterLines,
  getNarratorLines,
  propertyIsNamed
}
