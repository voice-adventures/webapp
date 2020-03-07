const acorn = require('acorn')
const escodegen = require('escodegen')
const propertyIsNamed = require('./getCharacterAudio').propertyIsNamed
const srs = require('secure-random-string')
let realGenerator = () => srs({length: 10, alphanumeric: true}).toLowerCase()

var audioFunctions = {"play": [0, 1], "singlePlay": [0, 1], "changeInventoryName": [1, 2], "addExit": [3, 4], "addSilentExit": [3, 4], "addExitAtIndex": [4,5], "changeExitDescription": [2, 3]}


function test(){

}

function addAudioFilenamesToScript(js, uuidGenerator) {
  try{
    let ast = acorn.parse(js, {allowReturnOutsideFunction: true})
    transform(ast)
    return escodegen.generate(ast)
  }catch(err){
    console.log(err, js)
    return escodegen.generate(acorn.parse(""))
  }


  function transform(ast) {
    if (isAudioFunction(ast) && isMissingAudioArgument(ast)){
      // console.log("is audio function", ast.callee.name, audioFunctions[ast.callee.name])
      if(!ast.arguments[audioFunctions[ast.callee.name][0]]){
        ast.arguments[audioFunctions[ast.callee.name][0]] = { type: 'Literal', value: ""}
      }
      ast.arguments[audioFunctions[ast.callee.name][1]] = { type: 'Literal', value: uuidGenerator() }

      // console.log(ast)
    }

    if (isTextAudioObject(ast) && isMissingAudioValue(ast)){
      // console.log("is audio object")
      let existingAudioProperty = ast.properties.find(propertyIsNamed('audio'))
      if (!existingAudioProperty) {
        ast.properties.push({key: {type: 'Identifier', name: 'audio'}, value: {type: 'Literal', value: uuidGenerator()}})
      } else {
        existingAudioProperty.value = {type: 'Literal', value: uuidGenerator()}
      }

      // ast = { type: 'Literal', value: uuidGenerator() }
    }

    if (ast && typeof ast === 'object') Object.values(ast).forEach(transform)
  }
}

function isAudioFunction(ast) {
  return ast && ast.type === 'CallExpression' && audioFunctions[ast.callee.name]
}

function isMissingAudioArgument(ast) {
  let audioArg = ast.arguments[audioFunctions[ast.callee.name][1]]
  return ast.arguments.length > 0 && (!audioArg || isEmptyStringNode(audioArg))
}

function isTextAudioObject(ast){
 return ast && ast.type === 'ObjectExpression' && ast.properties.some(propertyIsNamed('text'))
}

function isMissingAudioValue(ast){
  return ast && (
      ast.properties.every(p => !propertyIsNamed("audio")(p))
    || ast.properties.some(p => propertyIsNamed("audio")(p) && !p.value.value)
  )
}

function isEmptyStringNode(node) {
  return node.type === 'Literal' && node.value === ''
}

function addAudioFilenamesToGameObject(game, uuidGenerator = realGenerator){
  setAudioNames(game, uuidGenerator)
  findScripts(game, uuidGenerator)
}

function findScripts(o, uuidGenerator) {
  let results = []
  if(!o) return
  Object.keys(o).forEach(k => {
    switch (typeof o[k]) {
      case 'string':
        if (k === 'audio'
          || k === 'name'
          || k === 'id'
          || k === 'order'
          || k === 'aliases'
          || !isNaN(parseInt(k))) break

        if (k === 'script') {
          try{
            o[k] = addAudioFilenamesToScript(o[k], uuidGenerator)
          }catch(err){
            console.log(o)
          }
          break
        }
        //results.push(o[k])
        break

      case 'object':
        if(o) findScripts(o[k], uuidGenerator)
        break

      case 'array':
        findScripts(o[k], uuidGenerator)
        break
    }
  })
}

function setAudioNames(game, uuidGenerator){
  var lines = []
  for(var part of game.parts){
    setName(part.intro)
    if(part.sceneList){
      for(var scene of part.sceneList){
        scene.nameAudio = scene.nameAudio || uuidGenerator()
        setName(scene.intro)
        setName(scene.exits)
      }
    }
  }
  if(game.items){
    for(var item of game.items){
      setName(item.inventory)
      setName(item.inSceneDescription)
      setName(item.description)
      setName(item.combinationFailure)
      if(item.actions){
        for(var action of item.actions){
          setName(action.failure)
        }
      }
      var talk_to = item.actions ? item.actions.find(a => a.name === "talk to") : false
      if(talk_to){
        setName(talk_to.greeting)
        setName(talk_to.goodbye)
        setName(action.listTopics)
      }
      if(item.topics){
        for(var topic of item.topics){
          setName(topic.list)
          setName(topic.response)
        }
      }
    }
  }

  setCombinationAudio(game, setName)
  for (var key in game.defaultResponses){
    setName(game.defaultResponses[key])
  }

  function setName(list){
    if(list){
      if(Array.isArray(list)){
        for(var l of list){
          if(!l.audio) l.audio = uuidGenerator()
        }
      }else{
        if(!list.audio) list.audio = uuidGenerator()
      }
    }
  }
}

function setCombinationAudio(game, setName){
  if(game.combinations){
    for(var combo of game.combinations) {
      setName(combo.responses)
    }
  }
}

module.exports = {
  addAudioFilenamesToScript,
  addAudioFilenamesToGameObject,
  setAudioNames,
}
